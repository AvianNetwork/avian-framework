import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';
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

export class BuildGiftPsbtDto {
  @ApiProperty({ description: 'Sender\'s Avian wallet address', example: 'RCwfUYQCsKee7WviEHxsLMaH1NQNnJPHzF' })
  @IsString() @IsNotEmpty() senderAddress!: string;

  @ApiProperty({ description: 'Recipient\'s Avian wallet address', example: 'RDhoRWhxGLEDi1hnmdUAjRwgH5aGhS2Rh9' })
  @IsString() @IsNotEmpty() recipientAddress!: string;

  @ApiProperty({ description: 'Name of the Avian asset to gift', example: 'AVIANWALLPAPER' })
  @IsString() @IsNotEmpty() assetName!: string;

  @ApiProperty({ description: 'Amount of the asset to gift', example: 1 })
  @IsNotEmpty() assetAmount!: number;
}

export class SubmitGiftDto {
  @ApiProperty({ description: 'Signed PSBT ready to broadcast, from `walletprocesspsbt "..." true "ALL|FORKID"` in Avian Core', example: 'cHNidP8B...' })
  @IsString() @IsNotEmpty() psbtBase64!: string;

  @ApiProperty({ description: 'Sender address (for record-keeping)', example: 'RCwfUYQCsKee7WviEHxsLMaH1NQNnJPHzF' })
  @IsString() @IsNotEmpty() senderAddress!: string;

  @ApiProperty({ description: 'Recipient address', example: 'RDhoRWhxGLEDi1hnmdUAjRwgH5aGhS2Rh9' })
  @IsString() @IsNotEmpty() recipientAddress!: string;

  @ApiProperty({ description: 'Asset name', example: 'AVIANWALLPAPER' })
  @IsString() @IsNotEmpty() assetName!: string;

  @ApiProperty({ description: 'Asset amount', example: 1 })
  @IsNumber() @IsNotEmpty() assetAmount!: number;
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

    // Auto-detect asset UTXO if not provided — uses address index (no wallet required)
    if (!txid || vout === undefined) {
      const utxos = await this.rpc.getAddressUtxos([dto.sellerAddress], dto.assetName);
      const match = utxos.find((u) => {
        const amount = u.satoshis / 1e8;
        return amount >= dto.assetAmount;
      });
      if (!match) {
        throw new BadRequestException(
          `No confirmed UTXO found for asset "${dto.assetName}" at address ${dto.sellerAddress}. ` +
          `Ensure the address index is enabled (-addressindex=1) and the asset UTXO has at least 1 confirmation.`
        );
      }
      txid = match.txid;
      vout = match.outputIndex;
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

  // ─── Gift Flow ────────────────────────────────────────────────────────────────

  /** Estimated miner fee — whatever AVN is unaccounted for becomes the fee. */
  private static readonly GIFT_FEE_AVN = 0.001;

  /**
   * Build an unsigned gift PSBT using `createpsbt`.
   *
   * Inputs:
   *   [0] asset UTXO  — carries the asset (nValue = 0, contributes no AVN)
   *   [1] AVN UTXO    — pays the miner fee
   *
   * Outputs:
   *   [0] asset transfer to recipient via OP_AVN_ASSET
   *   [1] AVN change back to sender  (AVN input − fee)
   *
   * The implicit fee is AVN_input − change.
   * User signs with `walletprocesspsbt "..." true "ALL|FORKID"`.
   */
  async buildGiftPsbt(dto: BuildGiftPsbtDto) {
    // 1. Find asset UTXO (nValue = 0; only carries the asset)
    const assetUtxos = await this.rpc.getAddressUtxos([dto.senderAddress], dto.assetName);
    const assetUtxo = assetUtxos.find((u) => u.satoshis / 1e8 >= dto.assetAmount);
    if (!assetUtxo) {
      throw new BadRequestException(
        `No confirmed UTXO found for asset "${dto.assetName}" (need ${dto.assetAmount}) ` +
        `at address ${dto.senderAddress}.`
      );
    }

    // 2. Find AVN UTXO for fee — smallest one that covers the fee
    const feeAvn = PsbtService.GIFT_FEE_AVN;
    const feeSat = Math.ceil(feeAvn * 1e8);
    const avnUtxos = await this.rpc.getAddressUtxos([dto.senderAddress]);
    const feeUtxo = avnUtxos
      .filter((u) => u.satoshis >= feeSat && (!u.assetName || u.assetName === 'AVN'))
      .sort((a, b) => a.satoshis - b.satoshis)[0];
    if (!feeUtxo) {
      throw new BadRequestException(
        `No AVN UTXO >= ${feeAvn} AVN at ${dto.senderAddress} to cover the network fee.`
      );
    }

    // 3. Change = AVN input − fee  (asset UTXO contributes 0 AVN)
    const avnInput = feeUtxo.satoshis / 1e8;
    const changeAvn = Number((avnInput - feeAvn).toFixed(8));

    // 4. Build bare PSBT
    const inputs = [
      { txid: assetUtxo.txid, vout: assetUtxo.outputIndex },
      { txid: feeUtxo.txid,   vout: feeUtxo.outputIndex },
    ];
    const outputs: Record<string, number | { transfer: Record<string, number> }>[] = [
      { [dto.recipientAddress]: { transfer: { [dto.assetName]: dto.assetAmount } } },
    ];
    if (changeAvn > 0.00001) {
      outputs.push({ [dto.senderAddress]: changeAvn });
    }

    const psbtBase64 = await this.rpc.createPsbt(inputs, outputs);

    // 5. Attach UTXO data so the signer can verify amounts
    const enriched = await this.rpc.utxoUpdatePsbt(psbtBase64);
    const decoded  = await this.rpc.decodePsbt(enriched);

    return { psbtBase64: enriched, decoded, fee: feeAvn };
  }

  /**
   * Submit a signed gift PSBT for finalization and broadcast.
   *
   * NOTE: We skip the analyzePsbt-based `validateComplete()` check here
   * because Avian Core's `analyzepsbt` miscalculates fees for asset-transfer
   * outputs (OP_AVN_ASSET scripts). Instead we rely on `finalizepsbt` (fails
   * if any input is unsigned) and `testmempoolaccept` (consensus validation).
   */
  async submitGift(_senderAddress: string, dto: SubmitGiftDto) {
    // Finalize — converts partial signatures to scriptSig.  Fails if unsigned.
    const finalized = await this.rpc.finalizePsbt(dto.psbtBase64, true);
    if (!finalized.complete || !finalized.hex) {
      throw new BadRequestException(
        'PSBT finalization failed — ensure all inputs are signed with ' +
        '`walletprocesspsbt "..." true "ALL|FORKID"`.'
      );
    }

    // Consensus-level validation before broadcast
    const [acceptance] = await this.rpc.testMempoolAccept([finalized.hex]);
    if (!acceptance?.allowed) {
      throw new BadRequestException(
        `Transaction rejected by mempool: ${acceptance?.reject_reason ?? 'unknown'}`
      );
    }

    const txid = await this.rpc.sendRawTransaction(finalized.hex);

    // Record the gift for activity tracking
    await this.db.gift.create({
      data: {
        senderAddress: dto.senderAddress,
        recipientAddress: dto.recipientAddress,
        assetName: dto.assetName,
        assetAmount: dto.assetAmount,
        txid,
        feeAvn: PsbtService.GIFT_FEE_AVN,
      },
    });

    return { txid };
  }
}
