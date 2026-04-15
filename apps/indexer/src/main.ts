// Load .env in development (Docker injects env vars directly in production)
import { AvianRpcClient } from '@avian-framework/avian-rpc';
import { getPrismaClient } from '@avian-framework/database';
import Redis from 'ioredis';
import { BlockPoller } from './block-poller.js';
import { ExpiryWatcher } from './expiry-watcher.js';
import { AssetIndexer } from './asset-indexer.js';

async function main() {
  if (process.env['NODE_ENV'] !== 'production') {
    await import('dotenv/config');
  }

  const rpc = new AvianRpcClient({
    url: process.env['AVIAN_RPC_URL'] ?? 'http://127.0.0.1:7896',
    username: process.env['AVIAN_RPC_USER'] ?? 'avianrpc',
    password: process.env['AVIAN_RPC_PASS'] ?? '',
    wallet: process.env['AVIAN_RPC_WALLET'],
  });

  const db = getPrismaClient();
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

  console.log('Avian indexer starting...');

  const poller = new BlockPoller(rpc, db, redis);
  const expiryWatcher = new ExpiryWatcher(db, redis);
  const assetIndexer = new AssetIndexer(rpc, db);

  await Promise.all([poller.start(), expiryWatcher.start(), assetIndexer.start()]);
}

main().catch((err) => {
  console.error('Indexer fatal error:', err);
  process.exit(1);
});
