import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service.js';
import { ProfileController } from './profile.controller.js';
import { DatabaseModule } from '../../database/database.module.js';
import { RpcModule } from '../../rpc/rpc.module.js';

@Module({
  imports: [DatabaseModule, RpcModule],
  providers: [ProfileService],
  controllers: [ProfileController],
  exports: [ProfileService],
})
export class ProfileModule {}
