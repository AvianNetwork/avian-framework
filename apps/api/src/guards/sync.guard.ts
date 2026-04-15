import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import { AvianRpcClient } from '@avian-framework/avian-rpc';
import { AVIAN_RPC } from '../rpc/rpc.module.js';

/**
 * Guard that rejects requests while the Avian node is performing its
 * initial block download.  During sync, address indexes, asset balances,
 * and UTXO data are incomplete — allowing trades would risk incorrect
 * ownership validation.
 *
 * Apply to any controller or route that depends on accurate chain state.
 */
@Injectable()
export class SyncGuard implements CanActivate {
  /** Cache result for 30 s so we don't hammer the node on every request. */
  private cachedSyncing: boolean | null = null;
  private cachedAt = 0;
  private static readonly CACHE_TTL = 30_000;

  constructor(@Inject(AVIAN_RPC) private readonly rpc: AvianRpcClient) {}

  async canActivate(_context: ExecutionContext): Promise<boolean> {
    const now = Date.now();
    if (this.cachedSyncing !== null && now - this.cachedAt < SyncGuard.CACHE_TTL) {
      if (this.cachedSyncing) {
        throw new ServiceUnavailableException(
          'The Avian node is still syncing. Marketplace operations are disabled until the chain is fully synchronised.',
        );
      }
      return true;
    }

    try {
      const info = await this.rpc.getBlockchainInfo();
      this.cachedSyncing = info.initialblockdownload;
      this.cachedAt = now;

      if (info.initialblockdownload) {
        const pct = Math.round(info.verificationprogress * 10000) / 100;
        throw new ServiceUnavailableException(
          `The Avian node is still syncing (${pct}% complete). Marketplace operations are disabled until the chain is fully synchronised.`,
        );
      }
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      // RPC unreachable — assume syncing
      this.cachedSyncing = true;
      this.cachedAt = now;
      throw new ServiceUnavailableException(
        'Unable to reach the Avian node. Please try again later.',
      );
    }

    return true;
  }
}
