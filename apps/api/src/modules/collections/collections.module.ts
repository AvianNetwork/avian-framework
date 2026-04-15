import { Module } from '@nestjs/common';
import { CollectionsService } from './collections.service.js';
import { CollectionsController } from './collections.controller.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [CollectionsService],
  controllers: [CollectionsController],
  exports: [CollectionsService],
})
export class CollectionsModule {}
