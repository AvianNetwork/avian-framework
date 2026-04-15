import { Module } from '@nestjs/common';
import { LikesService } from './likes.service.js';
import { LikesController } from './likes.controller.js';
import { DatabaseModule } from '../../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  providers: [LikesService],
  controllers: [LikesController],
})
export class LikesModule {}
