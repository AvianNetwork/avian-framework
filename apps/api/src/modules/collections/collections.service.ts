import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { PrismaClient } from '@avian-framework/database';
import { AvianRpcClient } from '@avian-framework/avian-rpc';
import { PRISMA } from '../../database/database.module.js';
import { AVIAN_RPC } from '../../rpc/rpc.module.js';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

@Injectable()
export class CollectionsService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(AVIAN_RPC) private readonly rpc: AvianRpcClient,
  ) {}

  async findAll(page = 1, filter = '') {
    const pageSize = 20;
    const where = filter ? { name: { contains: filter, mode: 'insensitive' as const } } : {};
    const [data, total] = await this.db.$transaction([
      this.db.collection.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: {
            select: { username: true, displayName: true, avatarUrl: true },
          },
          _count: { select: { items: true } },
        },
      }),
      this.db.collection.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async findBySlug(slug: string) {
    const collection = await this.db.collection.findUnique({
      where: { slug },
      include: {
        owner: { select: { username: true, displayName: true, avatarUrl: true, address: true } },
        items: {
          orderBy: { displayOrder: 'asc' },
          include: {
            asset: {
              select: { name: true, hasIpfs: true, ipfsHash: true, amount: true, units: true },
            },
          },
        },
        _count: { select: { items: true } },
      },
    });
    if (!collection) throw new NotFoundException(`Collection "${slug}" not found`);
    return collection;
  }

  async create(
    ownerAddress: string,
    dto: {
      name: string;
      description?: string;
      website?: string;
      twitterHandle?: string;
      discordHandle?: string;
      royaltyPercent?: number;
    }
  ) {
    let slug = slugify(dto.name);
    // Ensure unique slug by appending suffix if needed
    const existing = await this.db.collection.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    return this.db.collection.create({
      data: {
        slug,
        name: dto.name,
        description: dto.description,
        website: dto.website,
        twitterHandle: dto.twitterHandle,
        discordHandle: dto.discordHandle,
        royaltyPercent: dto.royaltyPercent ?? null,
        ownerAddress,
      },
    });
  }

  async update(
    slug: string,
    ownerAddress: string,
    dto: {
      name?: string;
      description?: string;
      website?: string;
      twitterHandle?: string;
      discordHandle?: string;
      royaltyPercent?: number;
    }
  ) {
    const collection = await this.db.collection.findUnique({ where: { slug } });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.ownerAddress !== ownerAddress) throw new ForbiddenException('Not the owner');

    return this.db.collection.update({ where: { slug }, data: dto });
  }

  async remove(slug: string, ownerAddress: string) {
    const collection = await this.db.collection.findUnique({ where: { slug } });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.ownerAddress !== ownerAddress) throw new ForbiddenException('Not the owner');

    await this.db.collectionItem.deleteMany({ where: { collectionId: collection.id } });
    await this.db.collection.delete({ where: { slug } });
  }

  async addItem(slug: string, ownerAddress: string, assetName: string) {
    const collection = await this.db.collection.findUnique({ where: { slug } });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.ownerAddress !== ownerAddress) throw new ForbiddenException('Not the owner');

    const alreadyIn = await this.db.collectionItem.findUnique({
      where: { collectionId_assetName: { collectionId: collection.id, assetName } },
    });
    if (alreadyIn) throw new ConflictException('Asset already in collection');

    // Asset must exist in DB
    const asset = await this.db.asset.findUnique({ where: { name: assetName } });
    if (!asset) throw new NotFoundException(`Asset "${assetName}" not indexed yet`);

    // Verify the owner actually holds this asset
    let utxos: { satoshis: number }[] = [];
    try {
      utxos = await this.rpc.getAddressUtxos([ownerAddress], assetName);
    } catch {
      // RPC failure — don't block the add, ownership check best-effort
    }
    if (utxos.length === 0) {
      throw new ForbiddenException(`You do not hold any "${assetName}" tokens`);
    }

    const maxOrder = await this.db.collectionItem.aggregate({
      where: { collectionId: collection.id },
      _max: { displayOrder: true },
    });

    return this.db.collectionItem.create({
      data: {
        collectionId: collection.id,
        assetName,
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
      },
      include: {
        asset: {
          select: { name: true, hasIpfs: true, ipfsHash: true, amount: true, units: true },
        },
      },
    });
  }

  async removeItem(slug: string, ownerAddress: string, assetName: string) {
    const collection = await this.db.collection.findUnique({ where: { slug } });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.ownerAddress !== ownerAddress) throw new ForbiddenException('Not the owner');

    await this.db.collectionItem.delete({
      where: { collectionId_assetName: { collectionId: collection.id, assetName } },
    });
  }

  async reorderItems(slug: string, ownerAddress: string, order: string[]) {
    const collection = await this.db.collection.findUnique({ where: { slug } });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.ownerAddress !== ownerAddress) throw new ForbiddenException('Not the owner');

    await this.db.$transaction(
      order.map((assetName, idx) =>
        this.db.collectionItem.update({
          where: { collectionId_assetName: { collectionId: collection.id, assetName } },
          data: { displayOrder: idx },
        })
      )
    );
  }

  async updateAvatar(slug: string, ownerAddress: string, avatarUrl: string) {
    const collection = await this.db.collection.findUnique({ where: { slug } });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.ownerAddress !== ownerAddress) throw new ForbiddenException('Not the owner');
    return this.db.collection.update({ where: { slug }, data: { avatarUrl } });
  }

  async updateBanner(slug: string, ownerAddress: string, bannerUrl: string) {
    const collection = await this.db.collection.findUnique({ where: { slug } });
    if (!collection) throw new NotFoundException('Collection not found');
    if (collection.ownerAddress !== ownerAddress) throw new ForbiddenException('Not the owner');
    return this.db.collection.update({ where: { slug }, data: { bannerUrl } });
  }
}
