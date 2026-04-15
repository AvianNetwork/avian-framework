import { Module } from '@nestjs/common';
import { WatchesService } from './watches.service.js';
import { WatchesController } from './watches.controller.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [WatchesService],
  controllers: [WatchesController],
})
export class WatchesModule {}
