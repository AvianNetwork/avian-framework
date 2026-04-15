import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaClient } from '@avian-framework/database';
import { PRISMA } from '../../database/database.module.js';

@Injectable()
export class WatchesService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async watch(watcherAddress: string, watchedAddress: string) {
    if (watcherAddress === watchedAddress) {
      throw new BadRequestException('You cannot watch yourself.');
    }
    const watched = await this.db.user.findUnique({ where: { address: watchedAddress } });
    if (!watched) throw new NotFoundException('User not found.');

    await this.db.userWatch.upsert({
      where: { watcherAddress_watchedAddress: { watcherAddress, watchedAddress } },
      create: { watcherAddress, watchedAddress },
      update: {},
    });
  }

  async unwatch(watcherAddress: string, watchedAddress: string) {
    await this.db.userWatch.deleteMany({ where: { watcherAddress, watchedAddress } });
  }

  async getStatus(watcherAddress: string, watchedAddress: string): Promise<{ watching: boolean }> {
    const row = await this.db.userWatch.findUnique({
      where: { watcherAddress_watchedAddress: { watcherAddress, watchedAddress } },
    });
    return { watching: !!row };
  }
}
