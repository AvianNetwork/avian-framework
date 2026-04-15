import { Module } from '@nestjs/common';
import { BlindOffersController } from './blind-offers.controller.js';
import { BlindOffersService } from './blind-offers.service.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [BlindOffersController],
  providers: [BlindOffersService],
  exports: [BlindOffersService],
})
export class BlindOffersModule {}
