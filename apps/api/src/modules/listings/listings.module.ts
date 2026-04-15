import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
