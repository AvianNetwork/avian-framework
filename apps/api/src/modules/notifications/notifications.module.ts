import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { DatabaseModule } from '../../database/database.module.js';
import { EventsModule } from '../events/events.module.js';

@Module({
  imports: [DatabaseModule, EventsModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
