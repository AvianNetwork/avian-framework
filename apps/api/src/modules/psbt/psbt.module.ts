import { Module } from '@nestjs/common';
import { PsbtController } from './psbt.controller.js';
import { PsbtService } from './psbt.service.js';

@Module({
  controllers: [PsbtController],
  providers: [PsbtService],
  exports: [PsbtService],
})
export class PsbtModule {}
