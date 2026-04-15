import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AvianRpcClient } from '@avian-framework/avian-rpc';
import type { PrismaClient, Prisma } from '@avian-framework/database';
import { AVIAN_RPC } from '../../rpc/rpc.module.js';
import { PRISMA } from '../../database/database.module.js';

@Injectable()
export class AssetsService {
  constructor(
    @Inject(AVIAN_RPC) private readonly rpc: AvianRpcClient,
    @Inject(PRISMA) private readonly db: PrismaClient
  ) {}

  async listAssets(filter = '', page = 1, pageSize = 50, hasIpfs?: boolean) {
    const where: Record<string, unknown> = {};
    if (filter) where['name'] = { contains: filter, mode: 'insensitive' as const };
    if (hasIpfs) where['hasIpfs'] = true;
    const [data, total] = await this.db.$transaction([
      this.db.asset.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { listings: { where: { status: 'ACTIVE' } } },
          },
        },
      }),
      this.db.asset.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async getAsset(name: string) {
    const cached = await this.db.asset.findUnique({ where: { name } });
    if (cached) return cached;
    try {
      return await this.rpc.getAssetData(name);
    } catch {
      throw new NotFoundException(`Asset "${name}" not found`);
    }
  }

  async getBalancesByAddress(address: string) {
    const holders = await this.db.assetHolder.findMany({ where: { address } });
    return Object.fromEntries(holders.map((h) => [h.assetName, Number(h.balance)]));
  }

  /**
   * Re-sync asset_holders for a single asset from the RPC node.
   * Called after a sale broadcast so the Owner badge updates immediately
   * instead of waiting for the next periodic indexer cycle.
   */
  async syncAssetHolders(assetName: string) {
    const allHolders = await this.rpc.listAddressesByAsset(assetName);
    const now = new Date();
    const info = await this.rpc.getBlockchainInfo();
    const currentBlock = info.blocks;

    for (const [address, balance] of Object.entries(allHolders)) {
      await this.db.assetHolder.upsert({
        where: { assetName_address: { assetName, address } },
        create: { assetName, address, balance, lastSeenBlock: currentBlock, updatedAt: now },
        update: { balance, lastSeenBlock: currentBlock, updatedAt: now },
      });
    }

    // Prune addresses that no longer hold the asset
    await this.db.assetHolder.deleteMany({
      where: {
        assetName,
        address: { notIn: Object.keys(allHolders) },
      },
    });
  }

  async getHoldersByAsset(assetName: string) {
    try {
      return await this.rpc.listAddressesByAsset(assetName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/index|addressindex|not enabled|not supported/i.test(msg)) {
        throw new NotFoundException(
          'Address index is not enabled on this node. Restart avian-node with -addressindex=1 to enable this endpoint.'
        );
      }
      throw err;
    }
  }

  /**
   * Parse asset name and raw amount from an Avian scriptPubKey.
   * Format: ...OP_AVN_ASSET(0xc0) PUSH "rvnt" <nameLen> <name> [0x00] <8-byte-LE-amount> OP_DROP(0x75)
   */
  private parseAssetFromScript(scriptPubKey: string): { name: string; rawAmount: bigint } | null {
    try {
      const buf = Buffer.from(scriptPubKey, 'hex');
      for (let i = 0; i < buf.length - 10; i++) {
        if (buf[i] !== 0xc0) continue;          // OP_AVN_ASSET
        const pushLen = buf[i + 1];
        if (!pushLen || pushLen > 75) continue;  // must be a direct push
        const start = i + 2;
        if (start + pushLen > buf.length) continue;
        // Require "rvnt" (transfer), also accept "rvno" (ownership token)
        const marker = buf.toString('ascii', start, start + 4);
        if (marker !== 'rvnt' && marker !== 'rvno') continue;
        const nameLen = buf[start + 4];
        if (!nameLen || start + 5 + nameLen > start + pushLen) continue;
        const name = buf.toString('ascii', start + 5, start + 5 + nameLen);
        let pos = start + 5 + nameLen;
        if (buf[pos] === 0x00) pos++;           // skip null terminator
        // Little-endian uint64 amount (up to 8 bytes remaining in push)
        let rawAmount = 0n;
        const amountBytes = Math.min(8, start + pushLen - pos);
        for (let j = 0; j < amountBytes; j++) {
          rawAmount |= BigInt(buf[pos + j] ?? 0) << BigInt(j * 8);
        }
        return { name, rawAmount };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Find UTXOs for an address holding a specific asset.
   * Uses getaddressutxos (requires addressindex + assetindex on the node).
   */
  async getAssetUtxos(address: string, assetName: string) {
    let utxos: import('@avian-framework/avian-rpc').AddressUtxo[];
    try {
      utxos = await this.rpc.getAddressUtxos([address], assetName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`getaddressutxos RPC failed: ${msg}`);
    }

    return utxos.map((u) => ({
      txid: u.txid,
      vout: u.outputIndex,
      assetName: u.assetName ?? assetName,
      // getaddressutxos returns the asset quantity in satoshis (1e8 = 1 unit)
      assetAmount: u.satoshis / 1e8,
      height: u.height,
    }));
  }

  // ─── Asset Metadata ────────────────────────────────────────────────────────

  async getAssetMetadata(assetName: string) {
    return this.db.assetMetadata.findUnique({ where: { assetName } });
  }

  async setAssetMetadata(
    assetName: string,
    address: string,
    dto: { title?: string; description?: string; externalUrl?: string; traits?: unknown[] }
  ) {
    // Only the holder of the admin token (ASSETNAME!) may set canonical metadata
    const adminToken = `${assetName}!`;
    const adminHolder = await this.db.assetHolder.findUnique({
      where: { assetName_address: { assetName: adminToken, address } },
    });
    if (!adminHolder || Number(adminHolder.balance) <= 0) {
      throw new ForbiddenException(
        `Only the holder of ${adminToken} can set canonical metadata for this asset.`
      );
    }
    const data = {
      ...dto,
      traits: dto.traits !== undefined ? (dto.traits as Prisma.InputJsonValue) : undefined,
    };
    return this.db.assetMetadata.upsert({
      where: { assetName },
      create: { assetName, ...data, creatorAddress: address },
      update: { ...data },
    });
  }

  async getHolderNote(assetName: string, address: string) {
    return this.db.assetHolderNote.findUnique({
      where: { assetName_address: { assetName, address } },
    });
  }

  async setHolderNote(assetName: string, address: string, note: string) {
    return this.db.assetHolderNote.upsert({
      where: { assetName_address: { assetName, address } },
      create: { assetName, address, note, updatedAt: new Date() },
      update: { note, updatedAt: new Date() },
    });
  }

  // ─── Per-holder public metadata ────────────────────────────────────────────

  async getHolderMetadata(assetName: string, address: string) {
    return this.db.assetHolderMetadata.findUnique({
      where: { assetName_address: { assetName, address } },
    });
  }

  async setHolderMetadata(
    assetName: string,
    address: string,
    dto: { title?: string; description?: string; externalUrl?: string; traits?: unknown[] }
  ) {
    // Caller must currently hold the regular asset
    const holder = await this.db.assetHolder.findUnique({
      where: { assetName_address: { assetName, address } },
    });
    if (!holder || Number(holder.balance) <= 0) {
      throw new ForbiddenException('You must hold this asset to set holder metadata.');
    }
    const data = {
      ...dto,
      traits: dto.traits !== undefined ? (dto.traits as Prisma.InputJsonValue) : undefined,
    };
    return this.db.assetHolderMetadata.upsert({
      where: { assetName_address: { assetName, address } },
      create: { assetName, address, ...data, updatedAt: new Date() },
      update: { ...data, updatedAt: new Date() },
    });
  }
}
