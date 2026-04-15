import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IsString, IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { AvianRpcClient } from '@avian-framework/avian-rpc';
import { injectPsbtInput } from '@avian-framework/psbt-sdk';
import type { PrismaClient } from '@avian-framework/database';
import { PRISMA } from '../../database/database.module.js';
import { AVIAN_RPC } from '../../rpc/rpc.module.js';
import { ListingsService } from '../listings/listings.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export class CreateOfferDto {
  @ApiProperty({ description: 'ID of the listing to make an offer on', example: 'clxyz123...' })
  @IsString() listingId!: string;

  @ApiProperty({ description: 'Amount offered in AVN', example: 450 })
  @IsNumber() @IsPositive() offeredPriceAvn!: number;

  @ApiProperty({ required: false, description: 'Optional buyer PSBT if already constructed. If omitted, use POST /offers/:id/combine-psbt after creating the offer.', example: 'cHNidP8B...' })
  @IsOptional() @IsString() psbtBase64?: string;

  @ApiProperty({ required: false, description: 'Offer TTL in seconds (minimum 60). Defaults to 48 hours.', example: 172800 })
  @IsOptional() @IsNumber() @Min(60) ttlSeconds?: number;
}

export class CombineOfferPsbtDto {
  @ApiProperty({ description: 'Buyer funding PSBT from `walletcreatefundedpsbt \'[]\' \'[{"SELLER_ADDRESS": PRICE}]\'` in Avian Core', example: 'cHNidP8B...' })
  /** PSBT from `walletcreatefundedpsbt '[]' '[{"SELLER": PRICE}]'` on buyer's node */
  @IsString() buyerFundingPsbt!: string;
}

export class CompleteOfferDto {
  @ApiProperty({ description: 'Fully buyer-signed combined PSBT from `walletprocesspsbt "..." true "ALL"` in Avian Core', example: 'cHNidP8B...' })
  /** Buyer-signed combined PSBT from `walletprocesspsbt "..." true "ALL"` */
  @IsString() signedPsbt!: string;
}

@Injectable()
export class OffersService {
  constructor(
    @Inject(PRISMA) private readonly db: PrismaClient,
    @Inject(AVIAN_RPC) private readonly rpc: AvianRpcClient,
    private readonly listings: ListingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(buyerAddress: string, dto: CreateOfferDto) {
    const listing = await this.listings.findOne(dto.listingId);

    if (listing.sellerAddress === buyerAddress) {
      throw new BadRequestException('Cannot make an offer on your own listing.');
    }

    const expiresAt = dto.ttlSeconds
      ? new Date(Date.now() + dto.ttlSeconds * 1000)
      : undefined;

    const offer = await this.db.offer.create({
      data: {
        listingId: listing.id,
        buyerAddress,
        offeredPriceAvn: dto.offeredPriceAvn,
        psbtBase64: dto.psbtBase64,
        status: 'PENDING',
        expiresAt,
      },
    });

    this.notificationsService.create({
      address: listing.sellerAddress,
      type: 'offer_received',
      title: 'New offer received',
      body: `Someone offered ${dto.offeredPriceAvn} AVN for your listing of ${listing.assetName}.`,
      link: `/listings/${listing.id}`,
    }).catch(() => { /* non-critical */ });

    return offer;
  }

  async findByListing(listingId: string) {
    return this.db.offer.findMany({
      where: { listingId, status: { in: ['PENDING', 'ACCEPTED'] } },
      orderBy: { offeredPriceAvn: 'desc' },
    });
  }

  async findByBuyer(buyerAddress: string) {
    return this.db.offer.findMany({
      where: { buyerAddress },
      include: {
        listing: {
          select: {
            id: true,
            assetName: true,
            assetAmount: true,
            priceAvn: true,
            status: true,
            sellerAddress: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const offer = await this.db.offer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException(`Offer ${id} not found.`);
    return offer;
  }

  async accept(id: string, sellerAddress: string) {
    const offer = await this.findOne(id);
    const listing = await this.listings.findOne(offer.listingId);

    if (listing.sellerAddress !== sellerAddress) {
      throw new BadRequestException('Only the listing seller can accept offers.');
    }
    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Only pending offers can be accepted.');
    }

    const [updatedOffer] = await this.db.$transaction([
      this.db.offer.update({ where: { id }, data: { status: 'ACCEPTED' } }),
      // Reject all other pending offers on this listing
      this.db.offer.updateMany({
        where: { listingId: listing.id, id: { not: id }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      }),
      this.db.listing.update({
        where: { id: listing.id },
        data: { status: 'SOLD' },
      }),
    ]);

    this.notificationsService.create({
      address: offer.buyerAddress,
      type: 'offer_accepted',
      title: 'Your offer was accepted',
      body: `Your offer on ${listing.assetName} has been accepted. Proceed to complete the purchase.`,
      link: `/offers`,
    }).catch(() => { /* non-critical */ });

    return updatedOffer;
  }

  async reject(id: string, sellerAddress: string) {
    const offer = await this.findOne(id);
    const listing = await this.listings.findOne(offer.listingId);

    if (listing.sellerAddress !== sellerAddress) {
      throw new BadRequestException('Only the listing seller can reject offers.');
    }
    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Only pending offers can be rejected.');
    }

    const updated = await this.db.offer.update({ where: { id }, data: { status: 'REJECTED' } });

    this.notificationsService.create({
      address: offer.buyerAddress,
      type: 'offer_rejected',
      title: 'Your offer was rejected',
      body: `Your offer on ${listing.assetName} was declined by the seller.`,
      link: `/offers`,
    }).catch(() => { /* non-critical */ });

    return updated;
  }

  async withdraw(id: string, buyerAddress: string) {
    const offer = await this.findOne(id);

    if (offer.buyerAddress !== buyerAddress) {
      throw new BadRequestException('Only the buyer can withdraw their offer.');
    }
    if (offer.status !== 'PENDING') {
      throw new BadRequestException('Only pending offers can be withdrawn.');
    }

    return this.db.offer.update({ where: { id }, data: { status: 'WITHDRAWN' } });
  }

  /**
   * Decode the listing PSBT and return the seller's input UTXO details so
   * the buyer can build a correctly-structured funding PSBT with:
   *   walletcreatefundedpsbt '[{"txid":"...","vout":N}]' '[{"SELLER_ADDR":PRICE}]' 0 '{"add_inputs":true,"fee_rate":2}'
   *
   * The seller's input MUST be at index 0 in the buyer's funded PSBT so that
   * the seller's SINGLE|ANYONECANPAY signature (which commits to input[0] and output[0])
   * remains valid after the buyer's payment inputs are added.
   */
  async getFundingInfo(id: string) {
    const offer = await this.findOne(id);
    const listing = await this.listings.findOne(offer.listingId);

    if (offer.status !== 'ACCEPTED') {
      throw new BadRequestException('Only accepted offers have funding info.');
    }

    const decoded = await this.rpc.decodePsbt(listing.psbtBase64);
    const sellerInput = decoded.tx.vin[0];
    if (!sellerInput) {
      throw new BadRequestException('Listing PSBT has no inputs.');
    }

    return {
      sellerInputTxid: sellerInput.txid,
      sellerInputVout: sellerInput.vout,
      sellerInputSequence: sellerInput.sequence ?? 4294967293,
      sellerAddress: listing.sellerAddress,
      priceAvn: Number(listing.priceAvn),
      assetName: listing.assetName,
      assetAmount: Number(listing.assetAmount),
    };
  }

  /**
   * Inject the seller's partial signature (and non_witness_utxo) from the
   * stored listing PSBT into input[0] of the buyer's funded PSBT.
   *
   * WHY NOT combinepsbt:
   *   `combinepsbt` requires both PSBTs to have identical global unsigned
   *   transactions.  The listing PSBT has 1 input / 1 output; the buyer's
   *   funded PSBT has N inputs / M outputs — they can never be combined.
   *
   * HOW THIS WORKS:
   *   The seller signed with SINGLE|ANYONECANPAY which commits only to
   *   input[0] and output[0].  As long as the buyer's funded PSBT keeps
   *   the seller's UTXO at input[0] and the payment at output[0], the
   *   seller's signature is cryptographically valid in the new (larger)
   *   transaction.  We inject it at the binary BIP174 level.
   */
  async combinePsbt(id: string, buyerAddress: string, dto: CombineOfferPsbtDto) {
    const offer = await this.findOne(id);
    const listing = await this.listings.findOne(offer.listingId);

    if (offer.buyerAddress !== buyerAddress) {
      throw new BadRequestException('Only the buyer can complete this offer.');
    }
    if (offer.status !== 'ACCEPTED') {
      throw new BadRequestException('Only accepted offers can be completed.');
    }

    // Decode listing PSBT to extract seller's signature.
    // walletprocesspsbt may finalize the input (final_scriptSig) or leave it in partial_sigs.
    const decoded = await this.rpc.decodePsbt(listing.psbtBase64);
    const input0 = decoded.inputs[0];

    const partialSigs: Record<string, string> = {
      ...(input0?.partial_sigs ?? {}),
      ...(input0?.partial_signatures ?? {}),
    };
    const finalScriptSigHex = input0?.final_scriptSig?.hex;

    if (Object.keys(partialSigs).length === 0 && !finalScriptSigHex) {
      throw new BadRequestException(
        'The listing PSBT has no seller signature. ' +
        'The seller needs to cancel this listing and create a new one, ' +
        'making sure to run `walletprocesspsbt "<PSBT>" true "SINGLE|ANYONECANPAY"` ' +
        'and paste the `psbt` value from the result (not the original unsigned PSBT).'
      );
    }

    // Fetch the raw transaction containing the seller's asset UTXO so finalizepsbt
    // has the non_witness_utxo it needs for input[0]
    const sellerInputTxid = decoded.tx.vin[0]?.txid;
    const nonWitnessUtxoHex = sellerInputTxid
      ? await this.rpc.getRawTransactionHex(sellerInputTxid)
      : undefined;

    // Binary-inject seller's sig (and UTXO data) into input[0] of buyer's funded PSBT
    const enrichedPsbt = injectPsbtInput(dto.buyerFundingPsbt, 0, partialSigs, nonWitnessUtxoHex, finalScriptSigHex);

    return { combinedPsbt: enrichedPsbt };
  }

  /**
   * Step 2 of buyer completion: finalize and broadcast the buyer-signed combined PSBT.
   * Updates offer to COMPLETED and records the txid.
   */
  async complete(id: string, buyerAddress: string, dto: CompleteOfferDto) {
    const offer = await this.findOne(id);
    const listing = await this.listings.findOne(offer.listingId);

    if (offer.buyerAddress !== buyerAddress) {
      throw new BadRequestException('Only the buyer can complete this offer.');
    }
    if (offer.status !== 'ACCEPTED') {
      throw new BadRequestException('Only accepted offers can be completed.');
    }

    const finalized = await this.rpc.finalizePsbt(dto.signedPsbt, true);
    if (!finalized.complete || !finalized.hex) {
      throw new BadRequestException(
        'PSBT is not fully signed — cannot broadcast. Ensure you signed all inputs.'
      );
    }

    const txid = await this.rpc.sendRawTransaction(finalized.hex);

    await this.db.$transaction([
      this.db.offer.update({
        where: { id },
        data: { status: 'COMPLETED', psbtBase64: dto.signedPsbt },
      }),
      this.db.txEvent.create({
        data: {
          txid,
          type: 'BROADCAST',
          relatedListingId: listing.id,
          relatedOfferId: id,
        },
      }),
    ]);

    return { txid };
  }
}
