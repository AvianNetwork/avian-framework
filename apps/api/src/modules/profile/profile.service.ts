import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import type { PrismaClient } from '@avian-framework/database';
import { AvianRpcClient } from '@avian-framework/avian-rpc';
import { PRISMA } from '../../database/database.module.js';
import { AVIAN_RPC } from '../../rpc/rpc.module.js';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(AVIAN_RPC) private readonly rpc: AvianRpcClient,
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: {
        wallets: { select: { id: true, address: true, label: true, isPrimary: true, createdAt: true } },
        collections: {
          select: { id: true, slug: true, name: true, avatarUrl: true, isVerified: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPublicProfile(username: string) {
    const user = await this.db.user.findUnique({
      where: { username },
      select: {
        id: true,
        address: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        bannerUrl: true,
        bannerPosition: true,
        website: true,
        twitterHandle: true,
        discordHandle: true,
        createdAt: true,
        wallets: { select: { address: true, label: true, isPrimary: true } },
        collections: {
          select: { id: true, slug: true, name: true, avatarUrl: true, isVerified: true, description: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!user) throw new NotFoundException(`Profile "${username}" not found`);
    return user;
  }

  async updateProfile(
    userId: string,
    dto: {
      username?: string;
      displayName?: string;
      bio?: string;
      website?: string;
      twitterHandle?: string;
      discordHandle?: string;
    }
  ) {
    if (dto.username !== undefined) {
      // validate format
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(dto.username)) {
        throw new BadRequestException('Username must be 3–30 alphanumeric characters, underscores, or hyphens.');
      }
      const taken = await this.db.user.findUnique({ where: { username: dto.username } });
      if (taken && taken.id !== userId) throw new ConflictException('Username already taken.');
    }
    return this.db.user.update({ where: { id: userId }, data: dto });
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.db.user.update({ where: { id: userId }, data: { avatarUrl } });
  }

  async updateBanner(userId: string, bannerUrl: string) {
    return this.db.user.update({ where: { id: userId }, data: { bannerUrl } });
  }

  // ─── Wallet Linking ────────────────────────────────────────────────────────

  async issueLinkChallenge(newAddress: string): Promise<{ challenge: string; expiresAt: Date }> {
    const { randomBytes } = await import('crypto');
    const challenge = `avian-framework:link-wallet:${randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    // Re-use AuthChallenge table for link challenges
    await this.db.authChallenge.create({ data: { address: newAddress, challenge, expiresAt } });
    return { challenge, expiresAt };
  }

  async confirmWalletLink(
    userId: string,
    newAddress: string,
    challenge: string,
    signature: string,
    label?: string,
  ) {
    const record = await this.db.authChallenge.findUnique({ where: { challenge } });
    if (!record || record.address !== newAddress || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired challenge.');
    }

    const valid = await this.rpc.verifyMessage(newAddress, signature, challenge);
    if (!valid) throw new UnauthorizedException('Signature verification failed.');

    // Check not already a primary address of another user
    const existing = await this.db.user.findUnique({ where: { address: newAddress } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('This address already belongs to another account.');
    }

    // Check not already linked
    const alreadyLinked = await this.db.userWallet.findUnique({ where: { address: newAddress } });
    if (alreadyLinked) {
      if (alreadyLinked.userId === userId) throw new ConflictException('Wallet already linked to your account.');
      throw new ConflictException('This address is linked to another account.');
    }

    await this.db.authChallenge.update({ where: { id: record.id }, data: { usedAt: new Date() } });

    return this.db.userWallet.create({
      data: { userId, address: newAddress, label: label ?? null, isPrimary: false },
    });
  }

  async updateWalletLabel(userId: string, address: string, label: string | null) {
    const wallet = await this.db.userWallet.findUnique({ where: { address } });
    if (!wallet || wallet.userId !== userId) throw new NotFoundException('Wallet not found on your account.');
    return this.db.userWallet.update({ where: { address }, data: { label } });
  }

  async setDisplayPrimary(userId: string, address: string) {
    // Verify the wallet belongs to this user
    const wallet = await this.db.userWallet.findUnique({ where: { address } });
    if (!wallet || wallet.userId !== userId) throw new NotFoundException('Wallet not found on your account.');
    // Clear existing primary flag, then set new one — in a transaction
    await this.db.$transaction([
      this.db.userWallet.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } }),
      this.db.userWallet.update({ where: { address }, data: { isPrimary: true } }),
    ]);
  }

  async unlinkWallet(userId: string, address: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.address === address) throw new BadRequestException('Cannot unlink your primary wallet address.');

    const wallet = await this.db.userWallet.findUnique({ where: { address } });
    if (!wallet || wallet.userId !== userId) throw new NotFoundException('Wallet not found on your account.');

    await this.db.userWallet.delete({ where: { address } });
  }
}
