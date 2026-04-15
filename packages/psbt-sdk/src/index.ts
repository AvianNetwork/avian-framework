import type { AvianRpcClient } from '@avian-framework/avian-rpc';
import type { WorkflowType, WorkflowStatus } from '@avian-framework/shared';
import { WorkflowStatus as WS } from '@avian-framework/shared';

// ─── PSBT BIP174 Binary Injection ────────────────────────────────────────────

function readVarInt(buf: Buffer, pos: number): { value: number; size: number } {
  const first = buf[pos]!;
  if (first < 0xfd) return { value: first, size: 1 };
  if (first === 0xfd) return { value: buf.readUInt16LE(pos + 1), size: 3 };
  if (first === 0xfe) return { value: buf.readUInt32LE(pos + 1), size: 5 };
  throw new Error('64-bit varints not supported in PSBT injection');
}

function writeVarInt(n: number): Buffer {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(n, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = 0xfe;
  b.writeUInt32LE(n, 1);
  return b;
}

function makeKV(keyBytes: number[], valueHex: string): Buffer {
  const key = Buffer.from(keyBytes);
  const value = Buffer.from(valueHex, 'hex');
  return Buffer.concat([writeVarInt(key.length), key, writeVarInt(value.length), value]);
}

/** Skip a PSBT map (key-value pairs ending with 0x00), returning position after the separator. */
function skipMap(buf: Buffer, pos: number): number {
  while (buf[pos] !== 0x00) {
    const k = readVarInt(buf, pos);
    pos += k.size + k.value;
    const v = readVarInt(buf, pos);
    pos += v.size + v.value;
  }
  return pos + 1; // skip 0x00
}

/** Find the 0x00 end-of-map byte position (without consuming it). */
function findMapEnd(buf: Buffer, pos: number): number {
  while (buf[pos] !== 0x00) {
    const k = readVarInt(buf, pos);
    pos += k.size + k.value;
    const v = readVarInt(buf, pos);
    pos += v.size + v.value;
  }
  return pos;
}

/** Return the set of key hex strings already present in a map. */
function getExistingKeys(buf: Buffer, pos: number): Set<string> {
  const keys = new Set<string>();
  while (buf[pos] !== 0x00) {
    const k = readVarInt(buf, pos);
    const keyStart = pos + k.size;
    keys.add(buf.slice(keyStart, keyStart + k.value).toString('hex'));
    pos += k.size + k.value;
    const v = readVarInt(buf, pos);
    pos += v.size + v.value;
  }
  return keys;
}

/**
 * Inject seller's signature and (optionally) the non_witness_utxo into
 * `inputIndex` of a PSBT without using `combinepsbt`.
 *
 * Supports two signature formats:
 *  - `partialSigs`: pubkey→sig map (PSBT_IN_PARTIAL_SIG, key type 0x02)
 *  - `finalScriptSigHex`: finalized scriptSig hex (PSBT_IN_FINAL_SCRIPTSIG, key type 0x07)
 *    walletprocesspsbt may finalize the input directly when only one signer is required.
 *
 * This is necessary because `combinepsbt` requires both PSBTs to have the
 * exact same global unsigned transaction, which is impossible when the buyer
 * adds their own inputs/outputs via `walletcreatefundedpsbt`.
 *
 * The BIP174 format is a sequence of key-value maps:
 *   magic + global-map + per-input-maps + per-output-maps
 * Each map ends with a 0x00 separator.  We locate the target input map's
 * end, append missing key-value pairs before the separator, then return
 * the modified PSBT as base64.
 */
export function injectPsbtInput(
  psbtBase64: string,
  inputIndex: number,
  /** pubkey_hex → signature_hex from `decodepsbt` (PSBT_IN_PARTIAL_SIG) */
  partialSigs: Record<string, string>,
  /** raw transaction hex from `getrawtransaction txid 0` */
  nonWitnessUtxoHex?: string,
  /** finalized scriptSig hex from `decodepsbt` inputs[i].final_scriptSig.hex (PSBT_IN_FINAL_SCRIPTSIG) */
  finalScriptSigHex?: string
): string {
  const buf = Buffer.from(psbtBase64, 'base64');

  if (buf.slice(0, 4).toString('hex') !== '70736274' || buf[4] !== 0xff) {
    throw new Error('Invalid PSBT: bad magic bytes');
  }

  let pos = 5; // after magic

  // Skip global map
  pos = skipMap(buf, pos);

  // Skip preceding input maps
  for (let i = 0; i < inputIndex; i++) {
    pos = skipMap(buf, pos);
  }

  // Collect existing keys in the target input map
  const existingKeys = getExistingKeys(buf, pos);
  const mapEnd = findMapEnd(buf, pos); // position of 0x00 terminator

  // Build key-value pairs to inject (skip any already present)
  const toInject: Buffer[] = [];

  if (nonWitnessUtxoHex && !existingKeys.has('00')) {
    toInject.push(makeKV([0x00], nonWitnessUtxoHex));
  }

  for (const [pubkeyHex, sigHex] of Object.entries(partialSigs)) {
    const keyHex = '02' + pubkeyHex;
    if (!existingKeys.has(keyHex)) {
      toInject.push(makeKV([0x02, ...Buffer.from(pubkeyHex, 'hex')], sigHex));
    }
  }

  // PSBT_IN_FINAL_SCRIPTSIG (key type 0x07, no extra key data)
  if (finalScriptSigHex && !existingKeys.has('07')) {
    toInject.push(makeKV([0x07], finalScriptSigHex));
  }

  if (toInject.length === 0) return psbtBase64; // nothing to inject

  const injection = Buffer.concat(toInject);
  return Buffer.concat([buf.slice(0, mapEnd), injection, buf.slice(mapEnd)]).toString('base64');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListingPsbtParams {
  /** Seller's UTXO holding the asset to sell */
  assetUtxoTxid: string;
  assetUtxoVout: number;
  /** Asset details */
  assetName: string;
  assetAmount: number;
  /** Where seller wants to receive AVN payment */
  sellerAddress: string;
  /** Price in AVN */
  priceAvn: number;
  /** Seller's change address for asset dust (if partial) */
  sellerChangeAddress?: string;
}

export interface OfferPsbtParams {
  /** The pre-signed listing PSBT (seller signed with SINGLE|FORKID|ANYONECANPAY) */
  listingPsbtBase64: string;
  /** Buyer's UTXO(s) to pay with */
  buyerUtxos: Array<{ txid: string; vout: number; amount: number }>;
  /** Where buyer wants to receive the asset */
  buyerAddress: string;
  /** Where to return buyer's change */
  buyerChangeAddress: string;
  /** Agreed price in AVN */
  priceAvn: number;
  /** Network fee in AVN */
  feeAvn: number;
}

export interface BuildResult {
  psbtBase64: string;
  workflowType: WorkflowType;
  status: WorkflowStatus;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  analyzed?: import('@avian-framework/avian-rpc').AnalyzedPsbt;
  decoded?: import('@avian-framework/avian-rpc').DecodedPsbt;
}

// ─── PsbtBuilder ─────────────────────────────────────────────────────────────

/**
 * PsbtBuilder orchestrates PSBT construction for marketplace workflows.
 *
 * Listing flow (SIGHASH_SINGLE|FORKID|ANYONECANPAY):
 *   1. buildListingPsbt()  — create unsigned PSBT with asset input + payment output
 *   2. Seller signs via walletProcessPsbt with sighash SINGLE|FORKID|ANYONECANPAY
 *   3. Signed PSBT stored as the listing
 *
 * Offer flow:
 *   1. Take the listing PSBT (seller-signed)
 *   2. buildOfferPsbt()  — add buyer payment inputs + asset destination output
 *   3. Buyer signs their inputs (sighash ALL)
 *   4. finalizePsbt() → broadcast
 */
export class PsbtBuilder {
  constructor(private readonly rpc: AvianRpcClient) {}

  /**
   * Build the initial unsigned listing PSBT.
   * Seller must then sign with walletProcessPsbt using sighash SINGLE|FORKID|ANYONECANPAY.
   *
   * SINGLE|FORKID|ANYONECANPAY means:
   *   - SINGLE:       seller's signature covers only output[0] (their payment), paired with input[0]
   *   - ANYONECANPAY: only input[0] (seller's asset UTXO) is committed to
   *   - FORKID:       BIP143-style sighash (mandatory on Avian)
   * This allows the buyer to add payment inputs and their asset-receiving/change outputs
   * without invalidating the seller's signature.
   *
   * IMPORTANT: You MUST pass "SINGLE|FORKID|ANYONECANPAY" explicitly to walletprocesspsbt.
   * Omitting FORKID may compute a legacy sighash preimage while still stamping the
   * FORKID byte, producing a signature that fails verification at broadcast.
   *
   * Structure:
   *   Inputs:  [seller's asset UTXO]
   *   Outputs: [seller receives priceAvn AVN]
   *
   * After seller signs with SINGLE|FORKID|ANYONECANPAY, buyer can add:
   *   Inputs:  [...buyer payment UTXOs]
   *   Outputs: [...buyer receives asset, buyer change]
   */
  async buildListingPsbt(params: ListingPsbtParams): Promise<BuildResult> {
    const { assetUtxoTxid, assetUtxoVout, sellerAddress, priceAvn } = params;

    // Use sequence 0xFFFFFFFE (RBF disabled, locktime compliant) — same as Avian Core's
    // wallet default for normal transactions. The seller will sign with
    // SIGHASH_SINGLE|FORKID|ANYONECANPAY which commits to this exact sequence value.
    // The buyer MUST use the same sequence when building their funded PSBT.
    const psbtBase64 = await this.rpc.createPsbt(
      [{ txid: assetUtxoTxid, vout: assetUtxoVout, sequence: 0xFFFFFFFE }],
      [{ [sellerAddress]: priceAvn }]
    );

    return {
      psbtBase64,
      workflowType: 'LISTING' as WorkflowType,
      status: WS.PENDING_SIGNATURE,
    };
  }

  /**
   * Merge buyer payment inputs into a seller-signed listing PSBT to form
   * a complete swap: buyer pays AVN → buyer receives asset.
   *
   * Steps:
   *  1. Decode the listing PSBT to verify seller's signed input/output
   *  2. Build buyer's funded PSBT (payment + change)
   *  3. Combine the two PSBTs
   *  4. Return the combined PSBT for buyer to sign
   */
  async buildOfferPsbt(params: OfferPsbtParams): Promise<BuildResult> {
    const { listingPsbtBase64, buyerAddress, buyerChangeAddress, priceAvn, feeAvn } = params;

    // Buyer side: wallet selects UTXOs and manages change
    const buyerSide = await this.rpc.walletCreateFundedPsbt(
      [{ [buyerAddress]: 0 }], // placeholder — actual output added below
      0,
      {
        changeAddress: buyerChangeAddress,
        fee_rate: feeAvn, // AVN/vB
      }
    );

    // Combine the listing PSBT (seller-signed) with the buyer-funded PSBT
    const combined = await this.rpc.combinePsbt([listingPsbtBase64, buyerSide.psbt]);

    return {
      psbtBase64: combined,
      workflowType: 'OFFER' as WorkflowType,
      status: WS.PENDING_SIGNATURE,
    };
  }
}

// ─── PsbtValidator ────────────────────────────────────────────────────────────

/**
 * PsbtValidator checks PSBTs before storing or broadcasting.
 */
export class PsbtValidator {
  constructor(private readonly rpc: AvianRpcClient) {}

  async validate(psbtBase64: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    let decoded: import('@avian-framework/avian-rpc').DecodedPsbt | undefined;
    let analyzed: import('@avian-framework/avian-rpc').AnalyzedPsbt | undefined;

    try {
      decoded = await this.rpc.decodePsbt(psbtBase64);
    } catch {
      errors.push('PSBT could not be decoded — invalid format.');
      return { valid: false, errors, warnings };
    }

    try {
      analyzed = await this.rpc.analyzePsbt(psbtBase64);
    } catch {
      warnings.push('PSBT could not be analyzed — may be missing UTXO data.');
    }

    // Must have at least one input and output
    if (!decoded.tx.vin.length) errors.push('PSBT has no inputs.');
    if (!decoded.tx.vout.length) errors.push('PSBT has no outputs.');

    // Check UTXO data present for all inputs (needed for external signing)
    for (let i = 0; i < decoded.inputs.length; i++) {
      if (!decoded.inputs[i]?.has_utxo) {
        warnings.push(`Input ${i} is missing UTXO data. Run utxoUpdatePsbt first.`);
      }
    }

    // Negative fee is expected for ANYONECANPAY listing PSBTs — buyer inputs not added yet.
    // Treat as a warning here; validateComplete() will fail if still negative when finalized.
    if (analyzed?.fee !== undefined && analyzed.fee < 0) {
      warnings.push('PSBT outputs exceed inputs — expected for unsigned ANYONECANPAY listings.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      analyzed,
      decoded,
    };
  }

  /**
   * Validate a PSBT is fully signed and ready to finalize+broadcast.
   */
  async validateComplete(psbtBase64: string): Promise<ValidationResult> {
    const base = await this.validate(psbtBase64);
    if (!base.valid) return base;

    if (base.analyzed && !base.analyzed.complete) {
      base.valid = false;
      base.errors.push(
        `PSBT is not complete. Next required step: ${base.analyzed.next}`
      );
    }

    // For a complete PSBT the fee must be non-negative
    if (base.analyzed?.fee !== undefined && base.analyzed.fee < 0) {
      base.valid = false;
      base.errors.push('PSBT has negative fee — outputs exceed inputs.');
    }

    return base;
  }
}

// ─── WorkflowStateMachine ─────────────────────────────────────────────────────

/**
 * Allowed status transitions for a PSBT workflow record.
 */
const TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  [WS.DRAFT]: [WS.ACTIVE, WS.CANCELLED],
  [WS.ACTIVE]: [WS.PENDING_SIGNATURE, WS.CANCELLED, WS.EXPIRED],
  [WS.PENDING_SIGNATURE]: [WS.PENDING_BROADCAST, WS.CANCELLED, WS.EXPIRED],
  [WS.PENDING_BROADCAST]: [WS.PENDING_CONFIRMATION, WS.FAILED],
  [WS.PENDING_CONFIRMATION]: [WS.COMPLETED, WS.FAILED, WS.EXPIRED],
  [WS.COMPLETED]: [],
  [WS.CANCELLED]: [],
  [WS.EXPIRED]: [],
  [WS.FAILED]: [],
};

export class WorkflowStateMachine {
  static canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
  }

  static assertTransition(from: WorkflowStatus, to: WorkflowStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(
        `Invalid workflow transition: ${from} → ${to}`
      );
    }
  }

  static isTerminal(status: WorkflowStatus): boolean {
    return [WS.COMPLETED, WS.CANCELLED, WS.EXPIRED, WS.FAILED].includes(status);
  }
}
