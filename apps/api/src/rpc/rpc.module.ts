import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AvianRpcClient } from '@avian-framework/avian-rpc';
import { PsbtBuilder, PsbtValidator } from '@avian-framework/psbt-sdk';

export const AVIAN_RPC = 'AVIAN_RPC';
export const PSBT_BUILDER = 'PSBT_BUILDER';
export const PSBT_VALIDATOR = 'PSBT_VALIDATOR';

@Global()
@Module({
  providers: [
    {
      provide: AVIAN_RPC,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new AvianRpcClient({
          url: config.getOrThrow<string>('AVIAN_RPC_URL'),
          username: config.getOrThrow<string>('AVIAN_RPC_USER'),
          password: config.getOrThrow<string>('AVIAN_RPC_PASS'),
          wallet: config.get<string>('AVIAN_RPC_WALLET'),
        }),
    },
    {
      provide: PSBT_BUILDER,
      inject: [AVIAN_RPC],
      useFactory: (rpc: AvianRpcClient) => new PsbtBuilder(rpc),
    },
    {
      provide: PSBT_VALIDATOR,
      inject: [AVIAN_RPC],
      useFactory: (rpc: AvianRpcClient) => new PsbtValidator(rpc),
    },
  ],
  exports: [AVIAN_RPC, PSBT_BUILDER, PSBT_VALIDATOR],
})
export class RpcModule {}
