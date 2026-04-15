import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { IsString, IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { AvianRpcClient } from '@avian-framework/avian-rpc';
import { PsbtValidator } from '@avian-framework/psbt-sdk';
import type { PrismaClient } from '@avian-framework/database';
import { PRISMA } from '../../database/database.module.js';
import { AVIAN_RPC, PSBT_VALIDATOR } from '../../rpc/rpc.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export class CreateBlindOfferDto {
  @ApiProperty({ description: 'Name of the asset the buyer wants to purchase', example: 'RARE_COIN' })
  @IsString() assetName!: string;

  @ApiProperty({ description: 'Amount of the asset requested', example: 1 })
  @IsNumber() @IsPositive() assetAmount!: number;

  @ApiProperty({ description: 'Price the buyer is willing to pay in AVN', example: 450 })
  @IsNumber() @IsPositive() offeredPriceAvn!: number;

  @ApiProperty({ required: false, description: 'Offer TTL in seconds (minimum 60). Defaults to 48 hours.', example: 172800 })
  @IsOptional() @IsNumber() @Min(60) ttlSeconds?: number;
}

export class AcceptBlindOfferDto {
  @ApiProperty({ description: 'Seller\'s PSBT signed with SIGHASH_SINGLE|FORKID|ANYONECANPAY, accepting the blind offer. Build with POST /psbt/build-listing then sign in Avian Core.', example: 'cHNidP8B...' })
  /** Seller's pre-signed PSBT (signed with SIGHASH_SINGLE|FORKID|ANYONECANPAY) */
  @IsString() psbtBase64!: string;
}

@Injectable()
export class BlindOffersService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(AVIAN_RPC) private readonly rpc: AvianRpcClient,
    @Inject(PSBT_VALIDATOR) private readonly validator: PsbtValidator,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(buyerAddress: string, dto: CreateBlindOfferDto) {
    // Validate requested amount against total asset supply
    const assetData = await this.rpc.getAssetData(dto.assetName).catch(() => null);
    if (!assetData) {
      throw new BadRequestException(`Asset "${dto.assetName}" does not exist.`);
    }
    if (dto.assetAmount > assetData.amount) {
      throw new BadRequestException(
        `Requested amount ${dto.assetAmount} exceeds total supply of ${assetData.amount} for asset "${dto.assetName}".`
      );
    }

    const expiresAt = dto.ttlSeconds
      ? new Date(Date.now() + dto.ttlSeconds * 1000)
      : undefined;

    // If a PENDING offer from this buyer on this asset already exists, update it
    const existing = await this.db.blindOffer.findFirst({
      where: { buyerAddress, assetName: dto.assetName, status: 'PENDING' },
    });

    if (existing) {
      return this.db.blindOffer.update({
        where: { id: existing.id },
        data: {
          assetAmount: dto.assetAmount,
          offeredPriceAvn: dto.offeredPriceAvn,
          ttlSeconds: dto.ttlSeconds,
          expiresAt,
          updatedAt: new Date(),
        },
      });
    }

    const offer = await this.db.blindOffer.create({
      data: {
        buyerAddress,
        assetName: dto.assetName,
        assetAmount: dto.assetAmount,
        offeredPriceAvn: dto.offeredPriceAvn,
        status: 'PENDING',
        ttlSeconds: dto.ttlSeconds,
        expiresAt,
      },
    });

    // Notify any registered users who currently hold this asset
    this.notifyHolders(dto.assetName, dto.assetAmount, dto.offeredPriceAvn).catch(() => {
      // Non-critical — don't fail the request if notifications fail
    });

    return offer;
  }

  /** Look up current asset holders (via RPC) and notify those who have accounts. */
  private async notifyHolders(assetName: string, assetAmount: number, offeredPriceAvn: number) {
    const holders = await this.rpc.listAddressesByAsset(assetName).catch(() => ({}));
    const holderAddresses = Object.entries(holders)
      .filter(([, balance]) => balance >= assetAmount)
      .map(([address]) => address);

    if (holderAddresses.length === 0) return;

    // Only notify addresses that have registered accounts
    const registeredUsers = await this.db.user.findMany({
      where: { address: { in: holderAddresses } },
      select: { address: true },
    });

    await Promise.all(
      registeredUsers.map((user) =>
        this.notificationsService.create({
          address: user.address,
          type: 'offer_received',
          title: 'New blind offer received',
          body: `Someone offered ${offeredPriceAvn} AVN for your ${assetName}.`,
          link: '/blind-offers/received',
        })
      )
    );
  }

  async findByBuyer(buyerAddress: string) {
    return this.db.blindOffer.findMany({
      where: { buyerAddress },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByAsset(assetName: string) {
    return this.db.blindOffer.findMany({
      where: { assetName, status: 'PENDING' },
      orderBy: { offeredPriceAvn: 'desc' },
    });
  }

  /**
   * Returns pending blind offers for all assets held by the caller.
   * The RPC call fetches the seller's asset balances by address to determine
   * which asset names to query.
   */
  async findReceived(sellerAddress: string) {
    const balances = await this.rpc.listAssetBalancesByAddress(sellerAddress);
    const heldAssets = Object.keys(balances);
    if (heldAssets.length === 0) return [];

    const offers = await this.db.blindOffer.findMany({
      where: { assetName: { in: heldAssets }, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    // Only surface offers the seller can actually fulfill (balance >= requested amount)
    return offers.filter(
      (offer) => (balances[offer.assetName] ?? 0) >= Number(offer.assetAmount)
    );
  }

  async findOne(id: string) {
    const offer = await this.db.blindOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException(`Blind offer ${id} not found.`);
    return offer;
  }

  async reject(id: string, sellerAddress: string) {
    const offer = await this.findOne(id);
    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Only pending blind offers can be rejected.');
    }

    // Verify caller holds the requested asset
    const balances = await this.rpc.listAssetBalancesByAddress(sellerAddress);
    const balance = balances[offer.assetName] ?? 0;
    if (balance <= 0) {
      throw new BadRequestException(
        `You do not hold any ${offer.assetName} — cannot reject this offer.`
      );
    }

    const updated = await this.db.blindOffer.update({ where: { id }, data: { status: 'REJECTED' } });

    this.notificationsService.create({
      address: offer.buyerAddress,
      type: 'blind_offer_rejected',
      title: 'Your blind offer was rejected',
      body: `The holder of ${offer.assetName} declined your offer of ${Number(offer.offeredPriceAvn)} AVN.`,
      link: `/blind-offers?id=${id}`,
    }).catch(() => { /* non-critical */ });

    return updated;
  }

  async withdraw(id: string, buyerAddress: string) {
    const offer = await this.findOne(id);
    if (offer.buyerAddress !== buyerAddress) {
      throw new BadRequestException('Only the buyer can withdraw their blind offer.');
    }
    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Only pending blind offers can be withdrawn.');
    }
    return this.db.blindOffer.update({ where: { id }, data: { status: 'WITHDRAWN' } });
  }

  async deleteTerminal(id: string, buyerAddress: string) {
    const offer = await this.findOne(id);
    if (offer.buyerAddress !== buyerAddress) {
      throw new BadRequestException('Only the buyer can remove their blind offer.');
    }
    const terminal = ['WITHDRAWN', 'REJECTED', 'EXPIRED', 'COMPLETED'];
    if (!terminal.includes(offer.status)) {
      throw new BadRequestException('Only withdrawn, rejected, expired, or completed offers can be removed.');
    }
    await this.db.blindOffer.delete({ where: { id } });
  }

  /**
   * Seller accepts a blind offer by providing a signed PSBT.
   *
   * Atomically:
   *   1. Validates and creates the Listing (with seller's PSBT, priced at offeredPriceAvn)
   *   2. Creates an Offer already in ACCEPTED state so the buyer can proceed immediately
   *   3. Updates the BlindOffer to ACCEPTED with listingId + offerId
   *
   * Returns { offerId, listingId } so the buyer can navigate to /listings/:listingId
   * and see their offer is already accepted, then complete the purchase.
   */
  async accept(id: string, sellerAddress: string, dto: AcceptBlindOfferDto) {
    const blindOffer = await this.findOne(id);
    if (blindOffer.status !== 'PENDING') {
      throw new BadRequestException('Only pending blind offers can be accepted.');
    }

    // Verify seller holds enough of the asset to fulfill the offer
    const balances = await this.rpc.listAssetBalancesByAddress(sellerAddress);
    const sellerBalance = balances[blindOffer.assetName] ?? 0;
    if (sellerBalance < Number(blindOffer.assetAmount)) {
      throw new BadRequestException(
        `Insufficient balance: you hold ${sellerBalance} ${blindOffer.assetName} but this offer requires ${Number(blindOffer.assetAmount)}.`
      );
    }

    // Validate the PSBT is structurally sound and signed
    const result = await this.validator.validate(dto.psbtBase64);
    const structuralErrors = result.errors.filter(
      (e) => !e.toLowerCase().includes('negative fee') && !e.toLowerCase().includes('outputs exceed inputs')
    );
    if (structuralErrors.length > 0) {
      throw new BadRequestException(`Invalid PSBT: ${structuralErrors.join(', ')}`);
    }

    const input0 = result.decoded?.inputs[0];
    const hasFinalSig = !!input0?.final_scriptSig?.hex;
    const partialSigs = {
      ...(input0?.partial_sigs ?? {}),
      ...(input0?.partial_signatures ?? {}),
    };
    const isSigned = hasFinalSig || Object.keys(partialSigs).length > 0;
    if (!isSigned) {
      throw new BadRequestException(
        'The PSBT has not been signed. ' +
        'Run `walletprocesspsbt "<PSBT>" true "SINGLE|FORKID|ANYONECANPAY"` in your Avian Core console ' +
        'and paste the `psbt` value from the result.'
      );
    }

    // Atomically create listing (SOLD immediately), offer (ACCEPTED), and update blind offer
    const [listing, offer] = await this.db.$transaction(async (tx) => {
      const newListing = await tx.listing.create({
        data: {
          sellerAddress,
          assetName: blindOffer.assetName,
          assetAmount: blindOffer.assetAmount,
          priceAvn: blindOffer.offeredPriceAvn,
          psbtBase64: dto.psbtBase64,
          // Mark SOLD immediately — this listing exists only to carry the PSBT for this offer
          status: 'SOLD',
        },
      });

      const newOffer = await tx.offer.create({
        data: {
          listingId: newListing.id,
          buyerAddress: blindOffer.buyerAddress,
          offeredPriceAvn: blindOffer.offeredPriceAvn,
          status: 'ACCEPTED',
        },
      });

      await tx.blindOffer.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          listingId: newListing.id,
          offerId: newOffer.id,
        },
      });

      return [newListing, newOffer] as const;
    });

    this.notificationsService.create({
      address: blindOffer.buyerAddress,
      type: 'blind_offer_accepted',
      title: 'Your blind offer was accepted',
      body: `The holder of ${blindOffer.assetName} accepted your offer of ${Number(blindOffer.offeredPriceAvn)} AVN. Proceed to complete the purchase.`,
      link: `/blind-offers?id=${blindOffer.id}`,
    }).catch(() => { /* non-critical */ });

    return { offerId: offer.id, listingId: listing.id };
  }
}
