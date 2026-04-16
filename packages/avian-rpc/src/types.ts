// ─── RPC Client Config ───────────────────────────────────────────────────────

export interface AvianRpcConfig {
  url: string;
  username: string;
  password: string;
  /** Wallet name for multi-wallet RPC — appended as /wallet/<name> */
  wallet?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

// ─── Blockchain ───────────────────────────────────────────────────────────────

export interface BlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  chainwork: string;
  pruned: boolean;
}

// ─── UTXO / Transaction types ─────────────────────────────────────────────────

export interface RpcUtxo {
  txid: string;
  vout: number;
  address: string;
  label?: string;
  scriptPubKey: string;
  amount: number;
  confirmations: number;
  spendable: boolean;
  solvable: boolean;
  safe: boolean;
  /** Avian returns "asset" (lowercase) when queried with assetName query option */
  asset?: string;
  /** Avian returns "assetamount" (lowercase) when queried with assetName query option */
  assetamount?: number;
  /** Alias kept for compat — may not be returned by node */
  assetName?: string;
  assetAmount?: number;
}

export interface RpcInput {
  txid: string;
  vout: number;
  sequence?: number;
}

export type RpcOutput = Record<string, number | { transfer: Record<string, number> }>;

/**
 * Asset transfer output for `walletcreatefundedpsbt`.
 * Format: { asset_transfer: { name, amount }, address }
 */
export interface RpcAssetTransferOutput {
  asset_transfer: { name: string; amount: number };
  address: string;
}

/** Output entry accepted by `walletcreatefundedpsbt` — plain AVN or asset transfer. */
export type RpcFundedOutput = RpcOutput | RpcAssetTransferOutput;

export interface RpcDecodedInput {
  txid: string;
  vout: number;
  scriptSig: { asm: string; hex: string };
  sequence: number;
}

export interface RpcScriptPubKey {
  asm: string;
  hex: string;
  reqSigs?: number;
  type: string;
  address?: string;
  addresses?: string[];
}

export interface RpcDecodedOutput {
  value: number;
  n: number;
  scriptPubKey: RpcScriptPubKey;
  assetName?: string;
  assetAmount?: number;
}

// ─── Address Index UTXOs (getaddressutxos) ────────────────────────────────────

export interface AddressUtxo {
  address: string;
  txid: string;
  outputIndex: number;   // equivalent to vout
  script: string;
  satoshis: number;      // asset quantity in raw units (divide by 1e8 for display amount)
  height: number;
  assetName?: string;
}

export interface RpcDecodedTransaction {
  txid: string;
  hash: string;
  size: number;
  vsize: number;
  version: number;
  locktime: number;
  vin: RpcDecodedInput[];
  vout: RpcDecodedOutput[];
  hex?: string;
}
/** getblock with verbosity=2 — includes full decoded transactions */
export interface RpcBlock {
  hash: string;
  height: number;
  time: number;
  tx: RpcDecodedTransaction[];
}
// ─── PSBT types ───────────────────────────────────────────────────────────────

/**
 * Sighash types supported by Avian for walletprocesspsbt.
 *
 * IMPORTANT: Avian Core requires SIGHASH_FORKID (0x40) on all signatures.
 * Always use the explicit |FORKID variants to ensure the correct BIP143-style
 * sighash preimage is computed.  Omitting FORKID may cause the node to use a
 * legacy preimage while still stamping the FORKID byte, producing an invalid
 * signature that fails at broadcast time.
 *
 * For marketplace listings: SINGLE|FORKID|ANYONECANPAY
 * - SINGLE:       seller commits to output[0] (their payment) paired with input[0] (their asset UTXO)
 * - ANYONECANPAY: only seller's input is committed — buyer can add payment inputs freely
 * - FORKID:       BIP143-style sighash (mandatory on Avian)
 */
export type SigHashType =
  | 'ALL'
  | 'NONE'
  | 'SINGLE'
  | 'ALL|ANYONECANPAY'
  | 'NONE|ANYONECANPAY'
  | 'SINGLE|ANYONECANPAY'
  | 'ALL|FORKID'
  | 'NONE|FORKID'
  | 'SINGLE|FORKID'
  | 'ALL|FORKID|ANYONECANPAY'
  | 'NONE|FORKID|ANYONECANPAY'
  | 'SINGLE|FORKID|ANYONECANPAY';

export interface CreatePsbtOptions {
  locktime?: number;
  replaceable?: boolean;
}

export interface WalletCreateFundedPsbtOptions {
  add_inputs?: boolean;
  changeAddress?: string;
  changePosition?: number;
  includeWatching?: boolean;
  lockUnspents?: boolean;
  /** Fee rate in AVN/vB. Use this instead of conf_target on networks with limited transactions. */
  fee_rate?: number;
  subtractFeeFromOutputs?: number[];
  replaceable?: boolean;
  conf_target?: number;
  estimate_mode?: 'UNSET' | 'ECONOMICAL' | 'CONSERVATIVE';
}

export interface CreatePsbtResult {
  psbt: string;
  fee: number;
  changepos: number;
}

export interface ProcessPsbtResult {
  psbt: string;
  complete: boolean;
}

export interface FinalizePsbtResult {
  psbt: string;
  hex?: string;
  complete: boolean;
}

export interface DecodedPsbtInput {
  has_utxo: boolean;
  is_final: boolean;
  non_witness_utxo?: RpcDecodedTransaction;
  /** Avian/Bitcoin Core returns this as `partial_sigs` */
  partial_sigs?: Record<string, string>;
  /** Alias used by some node versions — prefer partial_sigs */
  partial_signatures?: Record<string, string>;
  bip32_derivs?: Array<{ pubkey: string; master_fingerprint: string; path: string }>;
  final_scriptSig?: { asm: string; hex: string };
}

export interface DecodedPsbtOutput {
  bip32_derivs?: Array<{ pubkey: string; master_fingerprint: string; path: string }>;
}

export interface DecodedPsbt {
  tx: RpcDecodedTransaction;
  inputs: DecodedPsbtInput[];
  outputs: DecodedPsbtOutput[];
  fee?: number;
}

export interface AnalyzedPsbtInput {
  has_utxo: boolean;
  is_final: boolean;
  next?: 'updater' | 'signer' | 'finalizer' | 'extractor';
  missing_pubkeys?: string[];
  missing_sigs?: string[];
}

export interface AnalyzedPsbt {
  inputs: AnalyzedPsbtInput[];
  estimated_vsize?: number;
  estimated_feerate?: number;
  fee?: number;
  next: 'updater' | 'signer' | 'finalizer' | 'extractor' | 'unknown';
  complete: boolean;
}

// ─── Asset RPC types ──────────────────────────────────────────────────────────

export interface AssetData {
  name: string;
  amount: number;
  units: number;
  reissuable: boolean;
  has_ipfs: boolean;
  ipfs_hash?: string;
  txid_str?: string;
}

export interface AssetBalanceByAddress {
  [assetName: string]: number;
}
