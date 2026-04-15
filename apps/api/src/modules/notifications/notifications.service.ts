import { Injectable, Inject } from '@nestjs/common';
import type { PrismaClient } from '@avian-framework/database';
import { PRISMA } from '../../database/database.module.js';
import { EventsGateway } from '../events/events.gateway.js';

export type NotificationType =
  | 'offer_received'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_expired'
  | 'offer_expiring_soon'
  | 'blind_offer_accepted'
  | 'blind_offer_rejected'
  | 'watched_user_listed'
  | 'listing_expired'
  | 'listing_expiring_soon';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    private readonly events: EventsGateway,
  ) {}

  async create(params: {
    address: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
  }) {
    const notification = await this.db.notification.create({
      data: {
        address: params.address,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
      },
    });
    // Push real-time via WebSocket if user is connected
    this.events.emitNotification(params.address, notification);
    return notification;
  }

  async findByAddress(address: string) {
    return this.db.notification.findMany({
      where: { address },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(address: string) {
    return this.db.notification.count({ where: { address, read: false } });
  }

  async markRead(id: string, address: string) {
    return this.db.notification.updateMany({
      where: { id, address },
      data: { read: true },
    });
  }

  async markAllRead(address: string) {
    return this.db.notification.updateMany({
      where: { address, read: false },
      data: { read: true },
    });
  }

  async deleteOne(id: string, address: string) {
    return this.db.notification.deleteMany({ where: { id, address } });
  }

  async deleteAll(address: string) {
    return this.db.notification.deleteMany({ where: { address } });
  }
}
