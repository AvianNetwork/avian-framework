import type {
  AvianRpcConfig,
  BlockchainInfo,
  RpcUtxo,
  RpcInput,
  RpcOutput,
  CreatePsbtOptions,
  CreatePsbtResult,
  ProcessPsbtResult,
  FinalizePsbtResult,
  DecodedPsbt,
  AnalyzedPsbt,
  AssetData,
  AssetBalanceByAddress,
  SigHashType,
  WalletCreateFundedPsbtOptions,
  RpcDecodedTransaction,
  RpcBlock,
  AddressUtxo,
} from './types.js';

export class AvianRpcClient {
  private rpcUrl: string;
  private authHeader: string;

  constructor(config: AvianRpcConfig) {
    this.rpcUrl = config.wallet
      ? `${config.url}/wallet/${config.wallet}`
      : config.url;
    this.authHeader =
      'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
  }

  /**
   * Generic JSON-RPC call for methods not covered by @aviannetwork/avian-rpc.
   * Used for all PSBT commands added in Avian Core 5.0.
   */
  private async callRpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const body = JSON.stringify({ jsonrpc: '1.0', id: method, method, params });
    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`RPC HTTP error ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { result: T; error: { message: string } | null };
    if (json.error) throw new Error(`RPC error [${method}]: ${json.error.message}`);
    return json.result;
  }

  // ─── Blockchain ─────────────────────────────────────────────────────────────

  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.callRpc<BlockchainInfo>('getblockchaininfo');
  }

  async getBlockCount(): Promise<number> {
    return this.callRpc<number>('getblockcount');
  }

  async getBestBlockHash(): Promise<string> {
    return this.callRpc<string>('getbestblockhash');
  }
  async getBlockHash(height: number): Promise<string> {
    return this.callRpc<string>('getblockhash', [height]);
  }

  /** verbosity=2 returns full decoded transactions inside the block */
  async getBlock(hash: string): Promise<RpcBlock> {
    return this.callRpc<RpcBlock>('getblock', [hash, 2]);
  }
  // ─── Wallet / UTXOs ─────────────────────────────────────────────────────────

  async listUnspent(
    minConf = 1,
    maxConf = 9999999,
    addresses?: string[],
    includeUnsafe = true,
    queryOptions?: { assetName?: string }
  ): Promise<RpcUtxo[]> {
    const params: unknown[] = [minConf, maxConf, addresses ?? []];
    if (queryOptions) {
      params.push(includeUnsafe);
      params.push(queryOptions);
    }
    return this.callRpc<RpcUtxo[]>('listunspent', params);
  }

  async getBalance(account = '*', minConf = 0): Promise<number> {
    return this.callRpc<number>('getbalance', [account, minConf]);
  }

  /**
   * Get UTXOs for one or more addresses using the address index.
   * Optionally filter by asset name. Does not require a wallet to be loaded.
   */
  async getAddressUtxos(addresses: string[], assetName?: string): Promise<AddressUtxo[]> {
    const query: Record<string, unknown> = { addresses };
    if (assetName) query['assetName'] = assetName;
    return this.callRpc<AddressUtxo[]>('getaddressutxos', [query]);
  }

  // ─── PSBT ───────────────────────────────────────────────────────────────────

  /**
   * Create a bare PSBT from explicit inputs and outputs.
   * Caller must provide change output manually.
   */
  async createPsbt(
    inputs: RpcInput[],
    outputs: RpcOutput | RpcOutput[],
    options?: CreatePsbtOptions
  ): Promise<string> {
    const params: unknown[] = [inputs, outputs];
    if (options?.locktime !== undefined) params.push(options.locktime);
    if (options?.replaceable !== undefined) params.push(options.replaceable);
    return this.callRpc<string>('createpsbt', params);
  }

  /**
   * Create a funded PSBT — wallet selects inputs and adds change automatically.
   * Use this for buyer payment inputs.
   */
  async walletCreateFundedPsbt(
    outputs: RpcOutput | RpcOutput[],
    locktime = 0,
    options?: WalletCreateFundedPsbtOptions
  ): Promise<CreatePsbtResult> {
    return this.callRpc<CreatePsbtResult>('walletcreatefundedpsbt', [
      [],
      outputs,
      locktime,
      options ?? {},
    ]);
  }

  /**
   * Sign a PSBT with the wallet's keys.
   *
   * For marketplace listings: seller uses sighashType='SINGLE|FORKID|ANYONECANPAY'
   * so their asset input and payment output are signed, but the buyer can still add
   * payment inputs and their own outputs.
   *
   * IMPORTANT: Always use the |FORKID variants explicitly on Avian.
   */
  async walletProcessPsbt(
    psbtBase64: string,
    sign = true,
    sighashType: SigHashType = 'ALL|FORKID',
    finalize = false
  ): Promise<ProcessPsbtResult> {
    return this.callRpc<ProcessPsbtResult>('walletprocesspsbt', [
      psbtBase64,
      sign,
      sighashType,
      finalize,
    ]);
  }

  /**
   * Combine multiple partially-signed PSBTs into one.
   * Used in parallel multi-party signing flows.
   */
  async combinePsbt(psbts: string[]): Promise<string> {
    return this.callRpc<string>('combinepsbt', [psbts]);
  }

  /**
   * Add UTXO data to a PSBT so external signers can verify inputs.
   */
  async utxoUpdatePsbt(psbtBase64: string): Promise<string> {
    return this.callRpc<string>('utxoupdatepsbt', [psbtBase64]);
  }

  /**
   * Finalize a fully-signed PSBT, optionally extracting the raw hex tx.
   */
  async finalizePsbt(psbtBase64: string, extract = true): Promise<FinalizePsbtResult> {
    return this.callRpc<FinalizePsbtResult>('finalizepsbt', [psbtBase64, extract]);
  }

  /**
   * Decode a PSBT into human-readable form for display or validation.
   */
  async decodePsbt(psbtBase64: string): Promise<DecodedPsbt> {
    return this.callRpc<DecodedPsbt>('decodepsbt', [psbtBase64]);
  }

  /**
   * Analyze a PSBT — check completeness and what step is next.
   */
  async analyzePsbt(psbtBase64: string): Promise<AnalyzedPsbt> {
    return this.callRpc<AnalyzedPsbt>('analyzepsbt', [psbtBase64]);
  }

  // ─── Raw Transactions ────────────────────────────────────────────────────────

  async decodeRawTransaction(hex: string): Promise<RpcDecodedTransaction> {
    return this.callRpc<RpcDecodedTransaction>('decoderawtransaction', [hex]);
  }

  async sendRawTransaction(hex: string): Promise<string> {
    return this.callRpc<string>('sendrawtransaction', [hex]);
  }

  async getRawTransaction(txid: string, verbose = true): Promise<RpcDecodedTransaction> {
    return this.callRpc<RpcDecodedTransaction>('getrawtransaction', [txid, verbose ? 1 : 0]);
  }

  async getRawTransactionHex(txid: string): Promise<string> {
    return this.callRpc<string>('getrawtransaction', [txid, 0]);
  }

  async testMempoolAccept(
    hexTxns: string[]
  ): Promise<Array<{ txid: string; allowed: boolean; reject_reason?: string }>> {
    return this.callRpc('testmempoolaccept', [hexTxns]);
  }

  // ─── Assets ──────────────────────────────────────────────────────────────────

  async getAssetData(assetName: string): Promise<AssetData> {
    return this.callRpc<AssetData>('getassetdata', [assetName]);
  }

  async listAssets(
    asset = '*',
    verbose = false,
    count = 300,
    start = 0
  ): Promise<AssetData[] | string[]> {
    // Avian returns an object { "NAME": {...} } when verbose=true, array of strings when verbose=false
    const raw = await this.callRpc<Record<string, AssetData> | string[]>('listassets', [asset, verbose, count, start]);
    if (!verbose || Array.isArray(raw)) return raw as string[];
    // Convert object to array, injecting name from key if missing
    return Object.entries(raw).map(([name, data]) => ({ ...data, name: data.name ?? name }));
  }

  async listMyAssets(
    asset = '*',
    verbose = false,
    count = 300,
    start = 0
  ): Promise<Record<string, number>> {
    return this.callRpc<Record<string, number>>('listmyassets', [asset, verbose, count, start]);
  }

  async listAssetBalancesByAddress(
    address: string,
    onlyTotal = false
  ): Promise<AssetBalanceByAddress> {
    return this.callRpc<AssetBalanceByAddress>('listassetbalancesbyaddress', [address, onlyTotal]);
  }

  async listAddressesByAsset(
    assetName: string,
    onlyTotal = false,
    count = 300,
    start = 0
  ): Promise<Record<string, number>> {
    return this.callRpc<Record<string, number>>('listaddressesbyasset', [
      assetName,
      onlyTotal,
      count,
      start,
    ]);
  }

  // ─── Wallet signing helpers ──────────────────────────────────────────────────

  /**
   * Sign a message with the wallet address private key.
   * Used for challenge-response authentication.
   */
  async signMessage(address: string, message: string): Promise<string> {
    return this.callRpc<string>('signmessage', [address, message]);
  }

  /**
   * Verify a signed message.
   */
  async verifyMessage(address: string, signature: string, message: string): Promise<boolean> {
    return this.callRpc<boolean>('verifymessage', [address, signature, message]);
  }
}
