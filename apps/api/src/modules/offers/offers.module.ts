import { Module } from '@nestjs/common';
import { OffersController } from './offers.controller.js';
import { OffersService } from './offers.service.js';
import { ListingsModule } from '../listings/listings.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [ListingsModule, NotificationsModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
