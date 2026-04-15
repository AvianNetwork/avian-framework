import { Injectable, Inject } from '@nestjs/common';
import type { PrismaClient } from '@avian-framework/database';
import { PRISMA } from '../../database/database.module.js';

@Injectable()
export class LikesService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  async getCount(targetType: string, targetId: string, address?: string) {
    const count = await this.db.like.count({ where: { targetType, targetId } });
    let liked = false;
    if (address) {
      const row = await this.db.like.findUnique({
        where: { address_targetType_targetId: { address, targetType, targetId } },
      });
      liked = !!row;
    }
    return { count, liked };
  }

  async toggle(targetType: string, targetId: string, address: string) {
    const existing = await this.db.like.findUnique({
      where: { address_targetType_targetId: { address, targetType, targetId } },
    });
    if (existing) {
      await this.db.like.delete({
        where: { address_targetType_targetId: { address, targetType, targetId } },
      });
      const count = await this.db.like.count({ where: { targetType, targetId } });
      return { liked: false, count };
    }
    await this.db.like.create({ data: { address, targetType, targetId } });
    const count = await this.db.like.count({ where: { targetType, targetId } });
    return { liked: true, count };
  }

  async unlike(targetType: string, targetId: string, address: string) {
    await this.db.like.deleteMany({ where: { address, targetType, targetId } });
    const count = await this.db.like.count({ where: { targetType, targetId } });
    return { liked: false, count };
  }
}
