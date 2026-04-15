import { Controller, Get, Patch, Delete, Param, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { address: string }) {
    return this.notifications.findByAddress(user.address);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { address: string }) {
    return this.notifications.unreadCount(user.address).then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: { address: string },
  ) {
    return this.notifications.markRead(id, user.address);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: { address: string }) {
    return this.notifications.markAllRead(user.address);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteOne(
    @Param('id') id: string,
    @CurrentUser() user: { address: string },
  ) {
    return this.notifications.deleteOne(id, user.address);
  }

  @Delete()
  @HttpCode(204)
  deleteAll(@CurrentUser() user: { address: string }) {
    return this.notifications.deleteAll(user.address);
  }
}
