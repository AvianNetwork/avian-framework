import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AvianRpcClient } from '@avian-framework/avian-rpc';
import { AVIAN_RPC } from '../../rpc/rpc.module.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(AVIAN_RPC) private readonly rpc: AvianRpcClient) {}

  @Get()
  @ApiOperation({ summary: 'Health check including node sync status' })
  async check() {
    try {
      const info = await this.rpc.getBlockchainInfo();
      return {
        status: 'ok',
        syncing: info.initialblockdownload,
        blocks: info.blocks,
        headers: info.headers,
        progress: Math.round(info.verificationprogress * 10000) / 100, // e.g. 98.45
        chain: info.chain,
      };
    } catch {
      return {
        status: 'error',
        syncing: true,
        blocks: 0,
        headers: 0,
        progress: 0,
        chain: 'unknown',
      };
    }
  }
}
