import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AvianRpcClient } from '@avian-framework/avian-rpc';
import { PsbtBuilder, PsbtValidator } from '@avian-framework/psbt-sdk';
import type { PrismaClient } from '@avian-framework/database';
import { AVIAN_RPC, PSBT_BUILDER, PSBT_VALIDATOR } from '../../rpc/rpc.module.js';
import { PRISMA } from '../../database/database.module.js';

export class BuildListingPsbtDto {
  @ApiProperty({ description: 'Name of the Avian asset to list', example: 'RARE_COIN' })
  @IsString() @IsNotEmpty() assetName!: string;

  @ApiProperty({ description: 'Amount of the asset to include in the listing', example: 1 })
  @IsNotEmpty() assetAmount!: number;

  @ApiProperty({ description: 'Seller\'s Avian wallet address', example: 'RHb9CdoiuW5oqBzP3gEBJXdEGjPNP5Xsb' })
  @IsString() @IsNotEmpty() sellerAddress!: string;

  @ApiProperty({ description: 'Asking price in AVN', example: 500 })
  @IsNotEmpty() priceAvn!: number;

  @ApiProperty({ required: false, description: 'TXID of the UTXO holding the asset. If omitted, auto-detected via listunspent on the connected node.', example: 'abc123...' })
  /** Optional — if omitted the service auto-detects from listunspent */
  @IsString() @IsOptional() assetUtxoTxid?: string;

  @ApiProperty({ required: false, description: 'Output index (vout) of the asset UTXO. Required if assetUtxoTxid is provided.', example: 0 })
  @IsOptional() assetUtxoVout?: number;
}

export class SubmitSignedPsbtDto {
  @ApiProperty({ description: 'ID of the listing this PSBT belongs to', example: 'clxyz123...' })
  @IsString() @IsNotEmpty() listingId!: string;

  @ApiProperty({ description: 'Buyer-signed combined PSBT ready to broadcast, from `walletprocesspsbt "..." true "ALL"` in Avian Core', example: 'cHNidP8B...' })
  /** Buyer-signed combined PSBT, ready to finalize */
  @IsString() @IsNotEmpty() psbtBase64!: string;
}

@Injectable()
export class PsbtService {
  constructor(
    @Inject(AVIAN_RPC) private readonly rpc: AvianRpcClient,
    @Inject(PSBT_BUILDER) private readonly builder: PsbtBuilder,
    @Inject(PSBT_VALIDATOR) private readonly validator: PsbtValidator,
    @Inject(PRISMA) private readonly db: PrismaClient
  ) {}

  /** Build an unsigned listing PSBT for the seller to review and sign. */
  async buildListingPsbt(dto: BuildListingPsbtDto) {
    let txid = dto.assetUtxoTxid;
    let vout = dto.assetUtxoVout;

    // Auto-detect asset UTXO if not provided
    if (!txid || vout === undefined) {
      const utxos = await this.rpc.listUnspent(1, 9999999, [dto.sellerAddress], true, { assetName: dto.assetName });
      const match = utxos.find((u) => {
        const name = u.asset ?? u.assetName;
        const amount = u.assetamount ?? u.assetAmount ?? 0;
        return name === dto.assetName && amount >= dto.assetAmount;
      });
      if (!match) {
        throw new BadRequestException(
          `No confirmed UTXO found for asset "${dto.assetName}" at address ${dto.sellerAddress}. ` +
          `Ensure your wallet is imported on this node, or provide assetUtxoTxid and assetUtxoVout manually.`
        );
      }
      txid = match.txid;
      vout = match.vout;
    }

    const result = await this.builder.buildListingPsbt({
      assetUtxoTxid: txid,
      assetUtxoVout: vout,
      assetName: dto.assetName,
      assetAmount: dto.assetAmount,
      sellerAddress: dto.sellerAddress,
      priceAvn: dto.priceAvn,
    });

    const enriched = await this.rpc.utxoUpdatePsbt(result.psbtBase64);
    const decoded = await this.rpc.decodePsbt(enriched);

    return { psbtBase64: enriched, decoded };
  }

  /** Decode a PSBT for display in the UI before signing. */
  async decodePsbt(psbtBase64: string) {
    const [decoded, analyzed] = await Promise.all([
      this.rpc.decodePsbt(psbtBase64),
      this.rpc.analyzePsbt(psbtBase64).catch(() => null),
    ]);
    return { decoded, analyzed };
  }

  /**
   * Submit a buyer-signed PSBT for finalization and broadcast.
   * Validates completeness → finalizes → broadcasts → records TXID.
   */
  async submitSignedPsbt(buyerAddress: string, dto: SubmitSignedPsbtDto) {
    const validation = await this.validator.validateComplete(dto.psbtBase64);
    if (!validation.valid) {
      throw new BadRequestException(
        `PSBT not ready to broadcast: ${validation.errors.join(', ')}`
      );
    }

    const finalized = await this.rpc.finalizePsbt(dto.psbtBase64, true);
    if (!finalized.complete || !finalized.hex) {
      throw new BadRequestException('PSBT finalization failed.');
    }

    // Test mempool acceptance before broadcasting
    const [acceptance] = await this.rpc.testMempoolAccept([finalized.hex]);
    if (!acceptance?.allowed) {
      throw new BadRequestException(
        `Transaction rejected by mempool: ${acceptance?.reject_reason ?? 'unknown'}`
      );
    }

    const txid = await this.rpc.sendRawTransaction(finalized.hex);

    // Record the broadcast event
    await this.db.psbtRecord.create({
      data: {
        workflowType: 'OFFER',
        status: 'PENDING_CONFIRMATION',
        psbtBase64: dto.psbtBase64,
        txid,
        sellerAddress: '',
        buyerAddress,
        assetName: '',
        assetAmount: 0,
        priceAvn: 0,
        listingId: dto.listingId,
      },
    });

    return { txid };
  }
}
