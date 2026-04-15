import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module.js';
import { AssetsModule } from './modules/assets/assets.module.js';
import { ListingsModule } from './modules/listings/listings.module.js';
import { OffersModule } from './modules/offers/offers.module.js';
import { BlindOffersModule } from './modules/blind-offers/blind-offers.module.js';
import { PsbtModule } from './modules/psbt/psbt.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { ProfileModule } from './modules/profile/profile.module.js';
import { CollectionsModule } from './modules/collections/collections.module.js';
import { LikesModule } from './modules/likes/likes.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { WatchesModule } from './modules/watches/watches.module.js';
import { DatabaseModule } from './database/database.module.js';
import { RpcModule } from './rpc/rpc.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 500 }]),
    DatabaseModule,
    RpcModule,
    AuthModule,
    AssetsModule,
    ListingsModule,
    OffersModule,
    BlindOffersModule,
    PsbtModule,
    EventsModule,
    ProfileModule,
    CollectionsModule,
    LikesModule,
    NotificationsModule,
    WatchesModule,
  ],
  providers: [
    // Apply rate limiting globally to all HTTP routes
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
