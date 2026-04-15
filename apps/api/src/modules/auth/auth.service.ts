import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import type { PrismaClient } from '@avian-framework/database';
import { AvianRpcClient } from '@avian-framework/avian-rpc';
import { PRISMA } from '../../database/database.module.js';
import { AVIAN_RPC } from '../../rpc/rpc.module.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(AVIAN_RPC) private readonly rpc: AvianRpcClient,
    private readonly jwt: JwtService
  ) {}

  /** Issue a challenge that the wallet must sign to prove ownership. */
  async issueChallenge(address: string): Promise<{ challenge: string; expiresAt: Date }> {
    const challenge = `avian-framework:auth:${randomBytes(32).toString('hex')}`;
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    await this.db.authChallenge.create({
      data: { address, challenge, expiresAt },
    });

    return { challenge, expiresAt };
  }

  /** Verify signed challenge and return JWT. */
  async verifyAndLogin(
    address: string,
    challenge: string,
    signature: string
  ): Promise<{ token: string; expiresAt: Date }> {
    const record = await this.db.authChallenge.findUnique({ where: { challenge } });

    if (
      !record ||
      record.address !== address ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired challenge.');
    }

    const valid = await this.rpc.verifyMessage(address, signature, challenge);
    if (!valid) throw new UnauthorizedException('Signature verification failed.');

    // Mark challenge as used
    await this.db.authChallenge.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    // Find user by primary address first, then by linked wallets
    let user = await this.db.user.findUnique({ where: { address } });

    if (!user) {
      // Check if this address is a linked secondary wallet
      const linkedWallet = await this.db.userWallet.findUnique({
        where: { address },
        include: { user: true },
      });
      user = linkedWallet?.user ?? null;
    }

    if (!user) {
      // New user — create with this as primary address
      user = await this.db.user.create({ data: { address } });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const token = this.jwt.sign({ sub: address, uid: user.id });

    return { token, expiresAt };
  }
}
