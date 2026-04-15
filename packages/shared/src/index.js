"use strict";
// ─── Network & Chain ────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsEvent = exports.TxEventType = exports.OfferStatus = exports.ListingStatus = exports.WorkflowStatus = exports.WorkflowType = exports.AssetType = exports.Network = void 0;
var Network;
(function (Network) {
    Network["MAINNET"] = "mainnet";
    Network["TESTNET"] = "testnet";
    Network["REGTEST"] = "regtest";
})(Network || (exports.Network = Network = {}));
// ─── Asset Types ─────────────────────────────────────────────────────────────
var AssetType;
(function (AssetType) {
    AssetType["ROOT"] = "root";
    AssetType["SUB"] = "sub";
    AssetType["UNIQUE"] = "unique";
    AssetType["QUALIFIER"] = "qualifier";
    AssetType["RESTRICTED"] = "restricted";
})(AssetType || (exports.AssetType = AssetType = {}));
// ─── PSBT Workflow ───────────────────────────────────────────────────────────
var WorkflowType;
(function (WorkflowType) {
    WorkflowType["LISTING"] = "LISTING";
    WorkflowType["OFFER"] = "OFFER";
    WorkflowType["ESCROW"] = "ESCROW";
    WorkflowType["AUCTION"] = "AUCTION";
})(WorkflowType || (exports.WorkflowType = WorkflowType = {}));
var WorkflowStatus;
(function (WorkflowStatus) {
    // Listing lifecycle
    WorkflowStatus["DRAFT"] = "DRAFT";
    WorkflowStatus["ACTIVE"] = "ACTIVE";
    WorkflowStatus["PENDING_SIGNATURE"] = "PENDING_SIGNATURE";
    WorkflowStatus["PENDING_BROADCAST"] = "PENDING_BROADCAST";
    WorkflowStatus["PENDING_CONFIRMATION"] = "PENDING_CONFIRMATION";
    WorkflowStatus["COMPLETED"] = "COMPLETED";
    WorkflowStatus["CANCELLED"] = "CANCELLED";
    WorkflowStatus["EXPIRED"] = "EXPIRED";
    WorkflowStatus["FAILED"] = "FAILED";
})(WorkflowStatus || (exports.WorkflowStatus = WorkflowStatus = {}));
// ─── Listings ────────────────────────────────────────────────────────────────
var ListingStatus;
(function (ListingStatus) {
    ListingStatus["ACTIVE"] = "ACTIVE";
    ListingStatus["SOLD"] = "SOLD";
    ListingStatus["CANCELLED"] = "CANCELLED";
    ListingStatus["EXPIRED"] = "EXPIRED";
})(ListingStatus || (exports.ListingStatus = ListingStatus = {}));
// ─── Offers ──────────────────────────────────────────────────────────────────
var OfferStatus;
(function (OfferStatus) {
    OfferStatus["PENDING"] = "PENDING";
    OfferStatus["ACCEPTED"] = "ACCEPTED";
    OfferStatus["REJECTED"] = "REJECTED";
    OfferStatus["WITHDRAWN"] = "WITHDRAWN";
    OfferStatus["EXPIRED"] = "EXPIRED";
    OfferStatus["COMPLETED"] = "COMPLETED";
})(OfferStatus || (exports.OfferStatus = OfferStatus = {}));
// ─── Transactions ─────────────────────────────────────────────────────────────
var TxEventType;
(function (TxEventType) {
    TxEventType["BROADCAST"] = "BROADCAST";
    TxEventType["CONFIRMED"] = "CONFIRMED";
    TxEventType["FAILED"] = "FAILED";
    TxEventType["REPLACED"] = "REPLACED";
})(TxEventType || (exports.TxEventType = TxEventType = {}));
// ─── WebSocket Events ─────────────────────────────────────────────────────────
var WsEvent;
(function (WsEvent) {
    WsEvent["LISTING_UPDATED"] = "listing:updated";
    WsEvent["OFFER_UPDATED"] = "offer:updated";
    WsEvent["TX_CONFIRMED"] = "tx:confirmed";
    WsEvent["WORKFLOW_COMPLETED"] = "workflow:completed";
    WsEvent["WORKFLOW_FAILED"] = "workflow:failed";
    WsEvent["NOTIFICATION"] = "notification";
})(WsEvent || (exports.WsEvent = WsEvent = {}));
//# sourceMappingURL=index.js.map