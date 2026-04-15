export declare enum Network {
    MAINNET = "mainnet",
    TESTNET = "testnet",
    REGTEST = "regtest"
}
export declare enum AssetType {
    ROOT = "root",
    SUB = "sub",
    UNIQUE = "unique",
    QUALIFIER = "qualifier",
    RESTRICTED = "restricted"
}
export interface Asset {
    name: string;
    type: AssetType;
    amount: number;
    units: number;
    reissuable: boolean;
    hasIpfs: boolean;
    ipfsHash?: string;
}
export interface AssetBalance {
    assetName: string;
    balance: number;
    address?: string;
}
export interface Utxo {
    txid: string;
    vout: number;
    address: string;
    amount: number;
    confirmations: number;
    spendable: boolean;
    assetName?: string;
    assetAmount?: number;
}
export declare enum WorkflowType {
    LISTING = "LISTING",
    OFFER = "OFFER",
    ESCROW = "ESCROW",
    AUCTION = "AUCTION"
}
export declare enum WorkflowStatus {
    DRAFT = "DRAFT",
    ACTIVE = "ACTIVE",
    PENDING_SIGNATURE = "PENDING_SIGNATURE",
    PENDING_BROADCAST = "PENDING_BROADCAST",
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED",
    FAILED = "FAILED"
}
export interface PsbtRecord {
    id: string;
    workflowType: WorkflowType;
    status: WorkflowStatus;
    psbtBase64: string;
    txid?: string;
    /** Seller's AVN address */
    sellerAddress: string;
    /** Buyer's AVN address (set when offer made) */
    buyerAddress?: string;
    assetName: string;
    assetAmount: number;
    /** Price in AVN */
    priceAvn: number;
    feesAvn?: number;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare enum ListingStatus {
    ACTIVE = "ACTIVE",
    SOLD = "SOLD",
    CANCELLED = "CANCELLED",
    EXPIRED = "EXPIRED"
}
export interface Listing {
    id: string;
    sellerAddress: string;
    assetName: string;
    assetAmount: number;
    priceAvn: number;
    /** Pre-signed PSBT from seller (SIGHASH_SINGLE|FORKID|ANYONECANPAY on asset input) */
    psbtBase64: string;
    status: ListingStatus;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateListingInput {
    sellerAddress: string;
    assetName: string;
    assetAmount: number;
    priceAvn: number;
    /** Optional: expiry in seconds from now */
    ttlSeconds?: number;
}
export declare enum OfferStatus {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    WITHDRAWN = "WITHDRAWN",
    EXPIRED = "EXPIRED",
    COMPLETED = "COMPLETED"
}
export interface Offer {
    id: string;
    listingId: string;
    buyerAddress: string;
    offeredPriceAvn: number;
    /** Buyer-signed PSBT (payment input signed, waiting for seller asset input) */
    psbtBase64?: string;
    status: OfferStatus;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateOfferInput {
    listingId: string;
    buyerAddress: string;
    offeredPriceAvn: number;
    ttlSeconds?: number;
}
export declare enum TxEventType {
    BROADCAST = "BROADCAST",
    CONFIRMED = "CONFIRMED",
    FAILED = "FAILED",
    REPLACED = "REPLACED"
}
export interface TxEvent {
    id: string;
    txid: string;
    type: TxEventType;
    blockHeight?: number;
    blockHash?: string;
    confirmations: number;
    relatedListingId?: string;
    relatedOfferId?: string;
    createdAt: Date;
}
export interface AuthChallenge {
    challenge: string;
    expiresAt: Date;
}
export interface AuthVerifyInput {
    address: string;
    challenge: string;
    signature: string;
}
export interface AuthSession {
    address: string;
    token: string;
    expiresAt: Date;
}
export interface ApiResponse<T> {
    data: T;
    meta?: Record<string, unknown>;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
}
export interface ApiError {
    statusCode: number;
    message: string;
    error?: string;
}
export declare enum WsEvent {
    LISTING_UPDATED = "listing:updated",
    OFFER_UPDATED = "offer:updated",
    TX_CONFIRMED = "tx:confirmed",
    WORKFLOW_COMPLETED = "workflow:completed",
    WORKFLOW_FAILED = "workflow:failed",
    NOTIFICATION = "notification"
}
export interface WsPayload<T = unknown> {
    event: WsEvent;
    data: T;
    timestamp: string;
}
//# sourceMappingURL=index.d.ts.map