import type { PrismaClient } from '@avian-framework/database';
import type Redis from 'ioredis';
import { WsEvent } from '@avian-framework/shared';

const CHECK_INTERVAL_MS = 60_000; // 1 minute
const WARN_AHEAD_MS = 24 * 60 * 60 * 1000; // 24 hours

export class ExpiryWatcher {
  private running = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly redis: Redis
  ) {}

  async start() {
    this.running = true;
    console.log('ExpiryWatcher started.');
    while (this.running) {
      try {
        await this.checkExpiries();
        await this.sendExpiryWarnings();
      } catch (err) {
        console.error('ExpiryWatcher error:', err);
      }
      await sleep(CHECK_INTERVAL_MS);
    }
  }

  stop() {
    this.running = false;
  }

  private async checkExpiries() {
    const now = new Date();

    // Expire active listings
    const expiredListings = await this.db.listing.updateManyAndReturn({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    }).catch(() =>
      this.db.listing
        .findMany({ where: { status: 'ACTIVE', expiresAt: { lt: now } } })
        .then(async (rows: Array<{ id: string; status: string }>) => {
          if (rows.length) {
            await this.db.listing.updateMany({
              where: { id: { in: rows.map((r: { id: string }) => r.id) } },
              data: { status: 'EXPIRED' },
            });
          }
          return rows;
        })
    );

    if (Array.isArray(expiredListings) && expiredListings.length > 0) {
      console.log(`ExpiryWatcher: expired ${expiredListings.length} listings`);
      for (const listing of expiredListings as Array<{ id: string; sellerAddress: string; assetName: string }>) {
        // Notify seller their listing expired
        await this.createNotification({
          address: listing.sellerAddress,
          type: 'listing_expired',
          title: 'Listing expired',
          body: `Your listing for ${listing.assetName} has expired.`,
          link: `/listings/${listing.id}`,
        });
        await this.redis.publish(
          'avian:events',
          JSON.stringify({
            event: WsEvent.LISTING_UPDATED,
            data: { id: listing.id, status: 'EXPIRED' },
          })
        );
      }
    }

    // Expire pending offers
    const expiredOffers = await this.db.offer.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      select: { id: true, buyerAddress: true, listing: { select: { assetName: true } } },
    });
    if (expiredOffers.length > 0) {
      await this.db.offer.updateMany({
        where: { id: { in: expiredOffers.map((o) => o.id) } },
        data: { status: 'EXPIRED' },
      });
      for (const offer of expiredOffers) {
        await this.createNotification({
          address: offer.buyerAddress,
          type: 'offer_expired',
          title: 'Offer expired',
          body: `Your offer on ${offer.listing.assetName} has expired.`,
        });
      }
    }
  }

  private async sendExpiryWarnings() {
    const now = new Date();
    const warnBefore = new Date(now.getTime() + WARN_AHEAD_MS);
    // Use a cutoff so we only warn once: items expiring within next 24h
    // but not already warned (we check by looking for existing warning notification)
    const soonListings = await this.db.listing.findMany({
      where: { status: 'ACTIVE', expiresAt: { gt: now, lt: warnBefore } },
      select: { id: true, sellerAddress: true, assetName: true, expiresAt: true },
    });

    for (const listing of soonListings) {
      const alreadyWarned = await this.db.notification.findFirst({
        where: { address: listing.sellerAddress, type: 'listing_expiring_soon', link: `/listings/${listing.id}` },
      });
      if (!alreadyWarned) {
        const hoursLeft = Math.round((listing.expiresAt!.getTime() - now.getTime()) / 3_600_000);
        await this.createNotification({
          address: listing.sellerAddress,
          type: 'listing_expiring_soon',
          title: 'Listing expiring soon',
          body: `Your listing for ${listing.assetName} expires in ~${hoursLeft}h.`,
          link: `/listings/${listing.id}`,
        });
      }
    }

    const soonOffers = await this.db.offer.findMany({
      where: { status: 'PENDING', expiresAt: { gt: now, lt: warnBefore } },
      select: { id: true, buyerAddress: true, expiresAt: true, listing: { select: { assetName: true, id: true } } },
    });

    for (const offer of soonOffers) {
      const alreadyWarned = await this.db.notification.findFirst({
        where: { address: offer.buyerAddress, type: 'offer_expiring_soon', link: `/listings/${offer.listing.id}` },
      });
      if (!alreadyWarned) {
        const hoursLeft = Math.round((offer.expiresAt!.getTime() - now.getTime()) / 3_600_000);
        await this.createNotification({
          address: offer.buyerAddress,
          type: 'offer_expiring_soon',
          title: 'Offer expiring soon',
          body: `Your offer on ${offer.listing.assetName} expires in ~${hoursLeft}h.`,
          link: `/listings/${offer.listing.id}`,
        });
      }
    }
  }

  private async createNotification(params: {
    address: string;
    type: string;
    title: string;
    body: string;
    link?: string;
  }) {
    await this.db.notification.create({
      data: { address: params.address, type: params.type, title: params.title, body: params.body, link: params.link },
    });
    // Also push real-time via Redis so the API gateway can forward it
    await this.redis.publish('avian:notifications', JSON.stringify(params));
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
