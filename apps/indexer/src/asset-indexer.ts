import type { AvianRpcClient, AssetData } from '@avian-framework/avian-rpc';
import type { PrismaClient } from '@avian-framework/database';

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // re-sync every 10 minutes
const BATCH_SIZE = 300;
const HOLDER_PAGE_SIZE = 300;

export class AssetIndexer {
  private running = false;

  constructor(
    private readonly rpc: AvianRpcClient,
    private readonly db: PrismaClient
  ) {}

  async start() {
    this.running = true;
    console.log('AssetIndexer started — initial sync...');
    await this.syncAllAssets();

    while (this.running) {
      await sleep(SYNC_INTERVAL_MS);
      if (!this.running) break;
      console.log('AssetIndexer: periodic re-sync...');
      await this.syncAllAssets();
    }
  }

  stop() {
    this.running = false;
  }

  private async syncAllAssets() {
    try {
      const info = await this.rpc.getBlockchainInfo();
      const currentBlock = info.blocks;

      let start = 0;
      let total = 0;

      while (true) {
        const batch = await this.rpc.listAssets('*', true, BATCH_SIZE, start) as AssetData[];

        if (!Array.isArray(batch) || batch.length === 0) break;

        for (const asset of batch) {
          await this.db.asset.upsert({
            where: { name: asset.name },
            create: {
              name: asset.name,
              amount: asset.amount,
              units: asset.units,
              reissuable: Boolean(asset.reissuable),
              hasIpfs: Boolean(asset.has_ipfs),
              ipfsHash: asset.ipfs_hash ?? null,
              lastSeenBlock: currentBlock,
            },
            update: {
              amount: asset.amount,
              reissuable: Boolean(asset.reissuable),
              hasIpfs: Boolean(asset.has_ipfs),
              ipfsHash: asset.ipfs_hash ?? null,
              lastSeenBlock: currentBlock,
            },
          });

          await this.syncHolders(asset.name, currentBlock);
        }

        total += batch.length;
        console.log(`AssetIndexer: synced ${total} assets so far...`);

        if (batch.length < BATCH_SIZE) break;
        start += BATCH_SIZE;
      }

      console.log(`AssetIndexer: sync complete — ${total} assets indexed at block ${currentBlock}`);
    } catch (err) {
      console.error('AssetIndexer sync error:', err);
    }
  }

  /**
   * Fetch all holders for one asset via paginated listaddressesbyasset and
   * upsert them into asset_holders.  Stale rows (addresses that no longer hold
   * the asset) are pruned after each full refresh.
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
      // Upsert each current holder
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
    } catch (err) {
      // addressindex may not be enabled — log and continue
      console.warn(`AssetIndexer: could not sync holders for ${assetName}:`, (err as Error).message);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
