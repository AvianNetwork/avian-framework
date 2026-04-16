import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsString, IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { PrismaClient } from '@avian-framework/database';
import { PsbtValidator } from '@avian-framework/psbt-sdk';
import { PRISMA } from '../../database/database.module.js';
import { PSBT_VALIDATOR } from '../../rpc/rpc.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export class CreateListingDto {
  @ApiProperty({ description: 'Name of the Avian asset to list', example: 'RARE_COIN' })
  @IsString() assetName!: string;

  @ApiProperty({ description: 'Amount of the asset to sell', example: 1 })
  @IsNumber() @IsPositive() assetAmount!: number;

  @ApiProperty({ description: 'Asking price in AVN', example: 500 })
  @IsNumber() @IsPositive() priceAvn!: number;

  @ApiProperty({ description: 'Base64-encoded PSBT pre-signed by the seller with SIGHASH_SINGLE|FORKID|ANYONECANPAY. Build this with POST /psbt/build-listing, sign with walletprocesspsbt in Avian Core, then submit here.', example: 'cHNidP8B...' })
  @IsString() psbtBase64!: string;

  @ApiProperty({ required: false, description: 'Listing TTL in seconds (minimum 60). Defaults to 7 days.', example: 604800 })
  @IsOptional() @IsNumber() @Min(60) ttlSeconds?: number;
}

@Injectable()
export class ListingsService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(PSBT_VALIDATOR) private readonly validator: PsbtValidator,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(sellerAddress: string, userId: string, dto: CreateListingDto) {
    // A listing PSBT is intentionally incomplete (signed SINGLE|FORKID|ANYONECANPAY — buyer inputs
    // not yet added), so analyzePsbt will report negative fee. Only check that it decodes.
    const result = await this.validator.validate(dto.psbtBase64);
    const structuralErrors = result.errors.filter(
      (e) => !e.toLowerCase().includes('negative fee') && !e.toLowerCase().includes('outputs exceed inputs')
    );
    if (structuralErrors.length > 0) {
      throw new BadRequestException(`Invalid PSBT: ${structuralErrors.join(', ')}`);
    }

    // Ensure the seller actually signed the PSBT — reject unsigned listings upfront.
    // walletprocesspsbt may finalize the input (moving sig to final_scriptSig) or leave
    // it in partial_sigs depending on node version and script type. Accept either.
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
        'and paste the `psbt` value from the result — not the original unsigned PSBT.'
      );
    }

    // Extract seller's input UTXO from the decoded PSBT so the block poller can
    // detect on-chain settlement even if the buyer broadcasts the tx themselves.
    const sellerInputTxid = result.decoded?.tx?.vin?.[0]?.txid ?? null;
    const sellerInputVout = result.decoded?.tx?.vin?.[0]?.vout ?? null;

    // Validate that the PSBT output[0] matches the claimed price and pays to an
    // address owned by this user.  The seller may hold the asset on a linked wallet
    // (secondary address) rather than the address they authenticated with, so we
    // check all addresses belonging to the user.
    const psbtOutput0 = result.decoded?.tx?.vout?.[0];
    if (psbtOutput0) {
      const psbtAddress = psbtOutput0.scriptPubKey?.address
        ?? psbtOutput0.scriptPubKey?.addresses?.[0];

      if (psbtAddress) {
        // Collect every address the user owns: primary + linked wallets
        const [user, linkedWallets] = await Promise.all([
          this.db.user.findUnique({ where: { id: userId }, select: { address: true } }),
          this.db.userWallet.findMany({ where: { userId }, select: { address: true } }),
        ]);
        const ownedAddresses = new Set<string>();
        if (user?.address) ownedAddresses.add(user.address);
        for (const w of linkedWallets) ownedAddresses.add(w.address);

        if (!ownedAddresses.has(psbtAddress)) {
          throw new BadRequestException(
            `PSBT output[0] pays to ${psbtAddress} which is not one of your linked wallet addresses. ` +
            'The PSBT payment address must belong to your account, ' +
            'or the buyer\'s transaction will fail at broadcast.'
          );
        }

        // NOTE: we intentionally keep sellerAddress as the user's primary
        // (auth) address for the FK constraint and ownership checks.
        // getFundingInfo() extracts the real PSBT payment address at runtime.
      }

      if (psbtOutput0.value !== dto.priceAvn) {
        throw new BadRequestException(
          `PSBT output[0] value is ${psbtOutput0.value} AVN but the listing price is ${dto.priceAvn} AVN. ` +
          'The PSBT payment amount must match the listed price.'
        );
      }
    }

    const expiresAt = dto.ttlSeconds
      ? new Date(Date.now() + dto.ttlSeconds * 1000)
      : undefined;

    const listing = await this.db.listing.create({
      data: {
        sellerAddress,
        assetName: dto.assetName,
        assetAmount: dto.assetAmount,
        priceAvn: dto.priceAvn,
        psbtBase64: dto.psbtBase64,
        sellerInputTxid,
        sellerInputVout,
        status: 'ACTIVE',
        expiresAt,
      },
    });

    // Notify watchers of this seller — fire-and-forget so it never blocks the response
    void this.notifyWatchers(sellerAddress, listing.id, dto.assetName, dto.priceAvn).catch(() => {});

    return listing;
  }

  private async notifyWatchers(
    sellerAddress: string,
    listingId: string,
    assetName: string,
    priceAvn: number,
  ) {
    const watches = await this.db.userWatch.findMany({
      where: { watchedAddress: sellerAddress },
      select: { watcherAddress: true },
    });
    if (watches.length === 0) return;

    const sellerUser = await this.db.user.findUnique({
      where: { address: sellerAddress },
      select: { username: true, displayName: true },
    });
    const sellerName = sellerUser?.displayName ?? sellerUser?.username ?? sellerAddress.slice(0, 8) + '…';

    await Promise.all(
      watches.map((w) =>
        this.notificationsService.create({
          address: w.watcherAddress,
          type: 'watched_user_listed',
          title: `${sellerName} listed ${assetName}`,
          body: `New listing for ${assetName} at ${priceAvn} AVN`,
          link: `/listings/${listingId}`,
        })
      )
    );
  }

  async findAll(
    assetName?: string,
    page = 1,
    pageSize = 20,
    sellerAddress?: string,
    minPrice?: number,
    maxPrice?: number,
    sort: 'newest' | 'oldest' | 'price_asc' | 'price_desc' = 'newest',
  ) {
    const where = {
      status: 'ACTIVE' as const,
      ...(assetName ? { assetName } : {}),
      ...(sellerAddress ? { sellerAddress } : {}),
      ...(minPrice != null || maxPrice != null
        ? {
            priceAvn: {
              ...(minPrice != null ? { gte: minPrice } : {}),
              ...(maxPrice != null ? { lte: maxPrice } : {}),
            },
          }
        : {}),
    };
    const orderBy =
      sort === 'price_asc'
        ? { priceAvn: 'asc' as const }
        : sort === 'price_desc'
          ? { priceAvn: 'desc' as const }
          : sort === 'oldest'
            ? { createdAt: 'asc' as const }
            : { createdAt: 'desc' as const };
    const [data, total] = await Promise.all([
      this.db.listing.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { asset: { select: { ipfsHash: true, hasIpfs: true } } },
      }),
      this.db.listing.count({ where }),
    ]);
    return { data, total, page, pageSize, hasNext: total > page * pageSize };
  }

  async findOne(id: string) {
    const listing = await this.db.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException(`Listing ${id} not found.`);
    // Attach an optional seller profile if the seller has registered a username
    const sellerUser = await this.db.user.findUnique({
      where: { address: listing.sellerAddress },
      select: { username: true, displayName: true, avatarUrl: true },
    });
    return { ...listing, sellerProfile: sellerUser ?? null };
  }

  async cancel(id: string, sellerAddress: string) {
    const listing = await this.findOne(id);
    if (listing.sellerAddress !== sellerAddress) {
      throw new BadRequestException('Only the seller can cancel this listing.');
    }
    if (listing.status !== 'ACTIVE') {
      throw new BadRequestException('Only active listings can be cancelled.');
    }
    return this.db.listing.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async getSales(address: string, page = 1, pageSize = 20) {
    const where = {
      status: 'SOLD' as const,
      OR: [{ sellerAddress: address }, { offers: { some: { buyerAddress: address, status: 'COMPLETED' as const } } }],
    };
    const [data, total] = await Promise.all([
      this.db.listing.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          asset: { select: { ipfsHash: true, hasIpfs: true } },
          offers: {
            where: { status: 'COMPLETED' },
            select: { buyerAddress: true, offeredPriceAvn: true },
            take: 1,
          },
        },
      }),
      this.db.listing.count({ where }),
    ]);
    // Tag each sale as bought or sold from this address's perspective
    const tagged = data.map((l) => ({
      ...l,
      role: l.sellerAddress === address ? 'sold' : 'bought',
      buyer: l.offers[0]?.buyerAddress ?? null,
      soldPrice: l.offers[0]?.offeredPriceAvn ?? l.priceAvn,
    }));
    return { data: tagged, total, page, pageSize };
  }

  async getGiftsByAddress(address: string, page = 1, pageSize = 20) {
    const where = {
      OR: [{ senderAddress: address }, { recipientAddress: address }],
    };
    const [data, total] = await Promise.all([
      this.db.gift.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.gift.count({ where }),
    ]);
    const tagged = data.map((g) => ({
      ...g,
      role: g.senderAddress === address ? 'sent' : 'received',
    }));
    return { data: tagged, total, page, pageSize };
  }

  /** Global marketplace stats or per-asset stats */
  async getStats(assetName?: string) {
    const soldWhere = { status: 'SOLD' as const, ...(assetName ? { assetName } : {}) };
    const activeWhere = { status: 'ACTIVE' as const, ...(assetName ? { assetName } : {}) };

    const [soldListings, activeListings] = await Promise.all([
      this.db.listing.findMany({
        where: soldWhere,
        select: { priceAvn: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.listing.findMany({
        where: activeWhere,
        select: { priceAvn: true },
        orderBy: { priceAvn: 'asc' },
      }),
    ]);

    const volume = soldListings.reduce((sum, l) => sum + Number(l.priceAvn), 0);
    const floorPrice = activeListings[0]?.priceAvn ? Number(activeListings[0].priceAvn) : null;
    const lastSale = soldListings[0]?.priceAvn ? Number(soldListings[0].priceAvn) : null;
    const lastSaleAt = soldListings[0]?.updatedAt ?? null;

    return {
      activeListings: activeListings.length,
      totalSales: soldListings.length,
      volume,
      floorPrice,
      lastSale,
      lastSaleAt,
    };
  }

  /** Trade history for a specific asset — all completed sales + gifts */
  async getAssetHistory(assetName: string, page = 1, pageSize = 20) {
    const saleWhere = { status: 'SOLD' as const, assetName };
    const giftWhere = { assetName };

    const [salesData, salesTotal, giftsData, giftsTotal] = await Promise.all([
      this.db.listing.findMany({
        where: saleWhere,
        orderBy: { updatedAt: 'desc' },
        include: {
          asset: { select: { ipfsHash: true, hasIpfs: true } },
          offers: {
            where: { status: 'COMPLETED' },
            select: { buyerAddress: true, offeredPriceAvn: true },
            take: 1,
          },
          txEvents: {
            where: { type: 'CONFIRMED' },
            select: { txid: true, blockHeight: true },
            take: 1,
          },
        },
      }),
      this.db.listing.count({ where: saleWhere }),
      this.db.gift.findMany({
        where: giftWhere,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.gift.count({ where: giftWhere }),
    ]);

    const sales = salesData.map((l) => ({
      id: l.id,
      type: 'sale' as const,
      assetName: l.assetName,
      assetAmount: l.assetAmount,
      priceAvn: l.offers[0]?.offeredPriceAvn ?? l.priceAvn,
      sellerAddress: l.sellerAddress,
      buyerAddress: l.offers[0]?.buyerAddress ?? null,
      txid: l.txEvents[0]?.txid ?? null,
      blockHeight: l.txEvents[0]?.blockHeight ?? null,
      date: l.updatedAt,
    }));

    const gifts = giftsData.map((g) => ({
      id: g.id,
      type: 'gift' as const,
      assetName: g.assetName,
      assetAmount: g.assetAmount,
      priceAvn: null,
      sellerAddress: g.senderAddress,
      buyerAddress: g.recipientAddress,
      txid: g.txid,
      blockHeight: null,
      date: g.createdAt,
    }));

    // Merge, sort by date descending, then paginate
    const merged = [...sales, ...gifts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const total = salesTotal + giftsTotal;
    const paged = merged.slice((page - 1) * pageSize, page * pageSize);

    return { data: paged, total, page, pageSize };
  }

  /** Global activity feed — recent completed sales + gifts across all assets */
  async getActivityFeed(page = 1, pageSize = 30) {
    const saleWhere = { status: 'SOLD' as const };

    const [salesData, salesTotal, giftsData, giftsTotal] = await Promise.all([
      this.db.listing.findMany({
        where: saleWhere,
        orderBy: { updatedAt: 'desc' },
        include: {
          asset: { select: { ipfsHash: true, hasIpfs: true } },
          offers: {
            where: { status: 'COMPLETED' },
            select: { buyerAddress: true, offeredPriceAvn: true },
            take: 1,
          },
          txEvents: {
            where: { type: 'CONFIRMED' },
            select: { txid: true, blockHeight: true },
            take: 1,
          },
        },
      }),
      this.db.listing.count({ where: saleWhere }),
      this.db.gift.findMany({ orderBy: { createdAt: 'desc' } }),
      this.db.gift.count(),
    ]);

    const sales = salesData.map((l) => ({
      id: l.id,
      type: 'sale' as const,
      assetName: l.assetName,
      assetAmount: l.assetAmount,
      priceAvn: l.offers[0]?.offeredPriceAvn ?? l.priceAvn,
      sellerAddress: l.sellerAddress,
      buyerAddress: l.offers[0]?.buyerAddress ?? null,
      txid: l.txEvents[0]?.txid ?? null,
      blockHeight: l.txEvents[0]?.blockHeight ?? null,
      date: l.updatedAt,
      ipfsHash: l.asset?.ipfsHash ?? null,
      hasIpfs: l.asset?.hasIpfs ?? false,
    }));

    const gifts = giftsData.map((g) => ({
      id: g.id,
      type: 'gift' as const,
      assetName: g.assetName,
      assetAmount: g.assetAmount,
      priceAvn: null,
      sellerAddress: g.senderAddress,
      buyerAddress: g.recipientAddress,
      txid: g.txid,
      blockHeight: null,
      date: g.createdAt,
      ipfsHash: null,
      hasIpfs: false,
    }));

    const merged = [...sales, ...gifts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const total = salesTotal + giftsTotal;
    const paged = merged.slice((page - 1) * pageSize, page * pageSize);

    return { data: paged, total, page, pageSize };
  }
}
