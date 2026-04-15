import type { AvianRpcClient } from '@avian-framework/avian-rpc';
import type { PrismaClient } from '@avian-framework/database';
import type Redis from 'ioredis';
import { WsEvent } from '@avian-framework/shared';

const POLL_INTERVAL_MS = 15_000; // 15 seconds
const CONFIRMATIONS_REQUIRED = 2;
const REDIS_LAST_BLOCK_KEY = 'indexer:lastBlock';
const HOLDER_PAGE_SIZE = 300;

export class BlockPoller {
  private running = false;

  constructor(
    private readonly rpc: AvianRpcClient,
    private readonly db: PrismaClient,
    private readonly redis: Redis
  ) {}

  async start() {
    this.running = true;
    console.log('BlockPoller started.');
    while (this.running) {
      try {
        await this.poll();
      } catch (err) {
        console.error('BlockPoller error:', err);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }

  stop() {
    this.running = false;
  }

  private async poll() {
    const info = await this.rpc.getBlockchainInfo();
    const currentHeight = info.blocks;

    const lastProcessed = parseInt(
      (await this.redis.get(REDIS_LAST_BLOCK_KEY)) ?? '0',
      10
    );

    if (currentHeight <= lastProcessed) return;

    console.log(`BlockPoller: processing blocks ${lastProcessed + 1}–${currentHeight}`);

    // Scan new blocks — detect asset transfers and on-chain settlement
    const { affectedAssets, spentUtxos } = await this.scanBlocks(lastProcessed + 1, currentHeight);

    if (affectedAssets.size > 0) {
      console.log(`BlockPoller: refreshing holders for ${affectedAssets.size} asset(s): ${[...affectedAssets].join(', ')}`);
      for (const assetName of affectedAssets) {
        await this.syncHolders(assetName, currentHeight);
      }
    }

    if (spentUtxos.size > 0) {
      await this.detectOnChainSettlements(spentUtxos);
    }

    // Check all pending PSBT records for confirmation
    await this.checkPendingConfirmations(currentHeight);

    await this.redis.set(REDIS_LAST_BLOCK_KEY, currentHeight.toString());
  }

  /**
   * Scan blocks from startHeight to endHeight inclusive.
   * Returns:
   *   affectedAssets — asset names seen in any vout (holders may have changed)
   *   spentUtxos     — Set of "txid:vout" strings for every input spent in these blocks
   */
  private async scanBlocks(
    startHeight: number,
    endHeight: number
  ): Promise<{ affectedAssets: Set<string>; spentUtxos: Set<string> }> {
    const affectedAssets = new Set<string>();
    const spentUtxos = new Set<string>();

    for (let h = startHeight; h <= endHeight; h++) {
      try {
        const hash = await this.rpc.getBlockHash(h);
        const block = await this.rpc.getBlock(hash);
        for (const tx of block.tx) {
          for (const vin of tx.vin) {
            if (vin.txid) spentUtxos.add(`${vin.txid}:${vin.vout}`);
          }
          for (const vout of tx.vout) {
            if (vout.assetName) affectedAssets.add(vout.assetName);
          }
        }
      } catch (err) {
        console.warn(`BlockPoller: could not scan block ${h}:`, (err as Error).message);
      }
    }

    return { affectedAssets, spentUtxos };
  }

  /**
   * For each spent UTXO, check whether it matches a listing's sellerInputTxid/Vout.
   * If so the trade settled on-chain (possibly via a direct wallet broadcast),
   * so mark the listing SOLD and any ACCEPTED offer COMPLETED.
   */
  private async detectOnChainSettlements(spentUtxos: Set<string>) {
    // Fetch all listings that have a stored seller UTXO and are not yet SOLD/CANCELLED
    const watchedListings = await this.db.listing.findMany({
      where: {
        sellerInputTxid: { not: null },
        status: { in: ['ACTIVE', 'SOLD'] },
      },
      include: {
        offers: {
          where: { status: 'ACCEPTED' },
          take: 1,
        },
      },
    });

    for (const listing of watchedListings) {
      if (!listing.sellerInputTxid) continue;
      const key = `${listing.sellerInputTxid}:${listing.sellerInputVout}`;
      if (!spentUtxos.has(key)) continue;

      // The seller's asset UTXO was spent — the trade settled on-chain
      console.log(`BlockPoller: on-chain settlement detected for listing ${listing.id}`);

      const acceptedOffer = listing.offers[0];
      await this.db.$transaction([
        this.db.listing.update({
          where: { id: listing.id },
          data: { status: 'SOLD' },
        }),
        ...(acceptedOffer
          ? [
              this.db.offer.update({
                where: { id: acceptedOffer.id },
                data: { status: 'COMPLETED' },
              }),
            ]
          : []),
      ]);

      await this.redis.publish(
        'avian:events',
        JSON.stringify({
          event: 'listing.settled',
          data: { listingId: listing.id, offerId: acceptedOffer?.id ?? null },
        })
      );
    }
  }

  /**
   * Refresh the asset_holders rows for one asset by calling listaddressesbyasset.
   * Prunes addresses that no longer hold the asset.
   */
  private async syncHolders(assetName: string, currentBlock: number) {
    try {
      const allHolders: Record<string, number> = {};
      let holderStart = 0;

      while (true) {
        const page = await this.rpc.listAddressesByAsset(
          assetName,
          false,
          HOLDER_PAGE_SIZE,
          holderStart
        );
        const entries = Object.entries(page);
        if (entries.length === 0) break;
        for (const [addr, bal] of entries) {
          allHolders[addr] = bal;
        }
        if (entries.length < HOLDER_PAGE_SIZE) break;
        holderStart += HOLDER_PAGE_SIZE;
      }

      const now = new Date();
      for (const [address, balance] of Object.entries(allHolders)) {
        await this.db.assetHolder.upsert({
          where: { assetName_address: { assetName, address } },
          create: { assetName, address, balance, lastSeenBlock: currentBlock, updatedAt: now },
          update: { balance, lastSeenBlock: currentBlock, updatedAt: now },
        });
      }

      // Prune stale holders
      await this.db.assetHolder.deleteMany({
        where: {
          assetName,
          address: { notIn: Object.keys(allHolders) },
        },
      });
    } catch (err) {
      console.warn(`BlockPoller: could not sync holders for ${assetName}:`, (err as Error).message);
    }
  }

  private async checkPendingConfirmations(currentHeight: number) {
    const pending = await this.db.psbtRecord.findMany({
      where: { status: 'PENDING_CONFIRMATION', txid: { not: null } },
    });

    for (const record of pending) {
      if (!record.txid) continue;

      try {
        const tx = await this.rpc.getRawTransaction(record.txid, true);
        const confirmations = (tx as unknown as { confirmations?: number }).confirmations ?? 0;

        if (confirmations >= CONFIRMATIONS_REQUIRED) {
          await this.db.$transaction([
            this.db.psbtRecord.update({
              where: { id: record.id },
              data: { status: 'COMPLETED' },
            }),
            // Update related listing to SOLD
            ...(record.listingId
              ? [
                  this.db.listing.update({
                    where: { id: record.listingId },
                    data: { status: 'SOLD' },
                  }),
                ]
              : []),
            this.db.txEvent.create({
              data: {
                txid: record.txid,
                type: 'CONFIRMED',
                confirmations,
                relatedListingId: record.listingId,
                relatedOfferId: record.offerId,
              },
            }),
          ]);

          // Publish event to Redis so the API WebSocket gateway can broadcast
          await this.redis.publish(
            'avian:events',
            JSON.stringify({
              event: WsEvent.TX_CONFIRMED,
              data: {
                txid: record.txid,
                listingId: record.listingId,
                confirmations,
              },
            })
          );

          console.log(`TX confirmed: ${record.txid} (${confirmations} confs)`);
        }
      } catch {
        // TX not found yet — still in mempool or not broadcast
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
