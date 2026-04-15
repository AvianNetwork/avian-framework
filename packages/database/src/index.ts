export { PrismaClient } from './generated/client/index.js';
export * from './generated/client/index.js';

import { PrismaClient } from './generated/client/index.js';

let prisma: PrismaClient | undefined;

/**
 * Returns a singleton Prisma client.
 * In development, stores the instance on globalThis to survive hot-reloads.
 */
export function getPrismaClient(): PrismaClient {
  if (process.env['NODE_ENV'] === 'production') {
    if (!prisma) prisma = new PrismaClient();
    return prisma;
  }

  const g = globalThis as typeof globalThis & { __prisma?: PrismaClient };
  if (!g.__prisma) g.__prisma = new PrismaClient();
  return g.__prisma;
}
