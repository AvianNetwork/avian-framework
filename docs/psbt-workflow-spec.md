# PSBT Workflow Specification — Avian Framework

Version: 0.1.0  
Chain: Avian Network (AVN), Avian Core 5.0.0  
Format: BIP 174 (non-witness UTXO variant)

---

## Overview

This document defines the PSBT-based workflow standard for Avian asset marketplace
flows. It is intentionally kept separate from any specific app implementation so
the same workflows can be used in:

- Web marketplace (this repo)
- Desktop wallet apps
- CLI tools
- Mobile apps

---

## PSBT Phases (BIP 174)

| Phase | Role | RPC Call |
|-------|------|----------|
| Creator | Proposes transaction structure | `createpsbt`, `walletcreatefundedpsbt` |
| Updater | Adds UTXO data for signing | `utxoupdatepsbt` |
| Signer | Adds partial signatures | `walletprocesspsbt` |
| Combiner | Merges partial PSBTs | `combinepsbt` |
| Finalizer | Converts partial sigs to final scriptSig | `finalizepsbt` |
| Extractor | Produces broadcast-ready raw tx | `finalizepsbt` (with `extract=true`) |
| Analyzer | Checks state and completeness | `analyzepsbt`, `decodepsbt` |

---

## Sighash Types

| Type | Meaning | Use case |
|------|---------|----------|
| `ALL` | Signs all inputs and outputs | Standard payment |
| `ALL\|ANYONECANPAY` | Signs this input + all outputs; others can add inputs | General multi-party use |
| `SINGLE` | Signs this input + its paired output | Advanced cases |
| `SINGLE\|ANYONECANPAY` | Signs this input + its **paired** output; others can add inputs/outputs | **Marketplace listings** — seller pre-signs asset input + payment output only |

---

## Workflow 1: Listing (Sell Asset for AVN)

### Goal
Seller lists an asset for a fixed AVN price. Buyer can atomically purchase
without the seller needing to be online at purchase time.

### Participants
- **Seller** — owns the asset UTXO, sets the price
- **Buyer** — has AVN UTXOs, wants the asset
- **App** — coordinates, never holds keys

### Step-by-step

```
1. Seller → App:  POST /psbt/build/listing
   Body: { assetName, assetAmount, sellerAddress, priceAvn,
           assetUtxoTxid? (optional), assetUtxoVout? (optional) }
   If assetUtxoTxid/Vout are omitted, the service auto-detects the UTXO
   via listunspent on the node.
   App: builds PSBT → utxoupdatepsbt (enrich with UTXO data) → decodepsbt
   Returns: { psbtBase64, decoded }

   PSBT structure:
     Inputs:  [seller's asset UTXO]
     Outputs: [seller receives priceAvn AVN]

2. Seller: imports PSBT into their Avian wallet, reviews, signs with:
   sighashType = "SINGLE|ANYONECANPAY"
   → Seller's input[0] + output[0] (payment) are locked;
     buyer can add their own inputs and outputs around them.

   avian-cli walletprocesspsbt "<psbt>" true "SINGLE|ANYONECANPAY" false
   Use the psbt field from the result (not the original).

3. Seller → App:  POST /listings
   Body: { assetName, assetAmount, priceAvn, psbtBase64 (seller-signed) }
   App validates PSBT is signed, stores listing as ACTIVE

4. Buyer: sees listing, decides to buy

5. Buyer → App:  POST /psbt/decode
   Body: { psbtBase64 }
   App returns: { decoded, analyzed }  — for UI display before the buyer signs

6. Buyer → App (direct purchase, no offer flow):
   POST /psbt/submit
   Body: { listingId, psbtBase64 (buyer-signed combined PSBT) }
   App: validates → finalizepsbt → testmempoolaccept → sendrawtransaction
   Returns: { txid }

7. Indexer: monitors for confirmations, updates listing status → SOLD
```

### PSBT Structure (Combined, before finalize)

```
Inputs:
  [0] seller's asset UTXO  — signed by seller (SINGLE|ANYONECANPAY)
  [1] buyer's AVN UTXO(s)  — signed by buyer (ALL)

Outputs:
  [0] seller receives priceAvn AVN      (from seller's listing — MUST stay at index 0)
  [1] buyer receives asset              (added by buyer)
  [2] buyer receives AVN change         (added by buyer)
```

> **Important:** The seller's `SINGLE|ANYONECANPAY` signature commits to input[0] and
> output[0] specifically. Both MUST remain at index 0 in the combined transaction or
> the seller's signature will be invalid.

---

## Workflow 2: Offer (Buyer Initiates Bid)

### Goal
Buyer makes an offer on a listed asset. Seller reviews and accepts or rejects. On
acceptance the buyer constructs the full transaction using the seller's pre-signed
PSBT and their own funding UTXOs, then broadcasts.

> **Prerequisite:** Workflow 2 requires a Workflow 1 listing to exist. The seller's
> SINGLE|ANYONECANPAY-signed PSBT (stored in the listing record) is injected into the
> buyer's funding PSBT at `combine-psbt` time. For the case where no listing exists yet,
> see Workflow 3 (Blind Offer) — the PSBT settlement path is identical once the seller accepts.

### Participants
- **Seller** — owns the listed asset, reviews and accepts/rejects offers
- **Buyer** — has AVN UTXOs, submits a bid price
- **App** — coordinates PSBT construction, never holds keys

### Step-by-step

```
1. Buyer → App:  POST /offers
   Body: { listingId, offeredPriceAvn, ttlSeconds? }
   App creates offer record (status: PENDING)

2. Seller: reviews offers via GET /offers/listing/:listingId
   Seller → App:  PATCH /offers/:id/accept
   App: marks offer ACCEPTED, marks all other PENDING offers REJECTED,
        marks listing SOLD
   (Seller can also PATCH /offers/:id/reject to reject individual offers)

3. Buyer: is notified (WebSocket / polling)
   Buyer → App:  GET /offers/:id/funding-info
   App returns: { sellerInputTxid, sellerInputVout, sellerInputSequence,
                  sellerAddress, priceAvn, assetName, assetAmount }

4. Buyer: constructs a funding PSBT on their own Avian node, seeding the
   seller's UTXO at input[0] so the seller's SINGLE|ANYONECANPAY sig stays valid:

   avian-cli walletcreatefundedpsbt \
     '[{"txid":"<sellerInputTxid>","vout":<sellerInputVout>,"sequence":<sellerInputSequence>}]' \
     '[{"<sellerAddress>":<priceAvn>}]' \
     0 '{"add_inputs":true,"fee_rate":2}'

5. Buyer → App:  POST /offers/:id/combine-psbt
   Body: { buyerFundingPsbt }  (from step 4)
   App: binary-injects the seller's partial signature + non_witness_utxo from
        the stored listing PSBT into input[0] of the buyer's funded PSBT.
        NOTE: avian-cli combinepsbt is NOT used — the two PSBTs have different
        transaction structures (1-in/1-out vs N-in/M-out) and cannot be combined
        with that RPC. A binary BIP174 injection is used instead.
   Returns: { combinedPsbt }

6. Buyer: signs the combined PSBT (signs only their own inputs with ALL)

   avian-cli walletprocesspsbt "<combinedPsbt>" true "ALL" false

7. Buyer → App:  POST /offers/:id/complete
   Body: { signedPsbt }  (buyer-signed combined PSBT from step 6)
   App: finalizepsbt → sendrawtransaction
   Returns: { txid }
   App: marks offer COMPLETED, records txid

8. Indexer: monitors for confirmations
```

### Additional offer operations

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /offers/my` | buyer | All offers made by authenticated buyer |
| `GET /offers/listing/:listingId` | public | Pending + accepted offers for a listing |
| `PATCH /offers/:id/reject` | seller | Reject a specific pending offer |
| `PATCH /offers/:id/withdraw` | buyer | Withdraw a pending offer |

---

## Workflow 3: Blind Offer (Buyer Bids Without a Listing)

### Goal
A buyer can express intent to purchase a specific asset before any listing exists.
The asset holder sees the bid, and if they accept they provide a signed PSBT.
The server then atomically creates a Listing + an already-ACCEPTED Offer, so the
buyer can complete the purchase immediately using the same steps as Workflow 2.

### Participants
- **Buyer** — knows the asset name and amount they want; submits a price bid
- **Seller (asset holder)** — sees blind offers for assets they hold; provides signed PSBT to accept
- **App** — stores the blind offer, coordinates PSBT acceptance, never holds keys

### Step-by-step

```
1. Buyer → App:  POST /blind-offers
   Body: { assetName, assetAmount, offeredPriceAvn, ttlSeconds? }
   App creates a BlindOffer record (status: PENDING)
   No PSBT is involved at this stage.

2. Seller: discovers offers via GET /blind-offers/received
   (Returns all PENDING blind offers for assets held by the authenticated user,
    detected from their on-chain balance via listassetbalancesbyaddress.)

3. Seller decides to accept:

   a. Seller builds a listing PSBT for the offered asset.
      In Avian Core console:

      # Find asset UTXO
      listunspent 1 9999999 [] true {"assetName":"<ASSET>"}

      # Create PSBT (seller's asset input → seller receives offered price)
      createpsbt \
        '[{"txid":"<txid>","vout":<vout>}]' \
        '[{"<sellerAddress>":<offeredPriceAvn>},{"<sellerAddress>":{"transfer":{"<ASSET>":<amount>}}}]'

      # Sign with SINGLE|ANYONECANPAY
      walletprocesspsbt "<psbt>" true "SINGLE|ANYONECANPAY"
      # Use the "psbt" field from the result.

   b. Seller → App:  POST /blind-offers/:id/accept
      Body: { psbtBase64 }  (signed PSBT from step 3a)
      App:
        - Validates PSBT is structurally sound and signed
        - Creates a Listing (status: SOLD) with the seller's PSBT
        - Creates an Offer (status: ACCEPTED) for the buyer
        - Updates the BlindOffer (status: ACCEPTED, listingId, offerId)
      Returns: { listingId, offerId }

4. Buyer: polls GET /blind-offers/my and detects status transition to ACCEPTED.
   The response includes listingId and offerId.

5. Buyer → App:  GET /offers/:id/funding-info
   App returns: { sellerInputTxid, sellerInputVout, sellerInputSequence,
                  sellerAddress, priceAvn, assetName, assetAmount }

6–8. Buyer completes the purchase using Workflow 2 steps 4–8 (combine-psbt → sign → complete).
     The PSBT flow is identical: the seller's SINGLE|ANYONECANPAY sig is injected into
     the buyer's funding PSBT via POST /offers/:id/combine-psbt, the buyer signs, and the
     app finalizes and broadcasts.
```

### Additional blind offer operations

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /blind-offers/my` | buyer | All blind offers submitted by the buyer |
| `GET /blind-offers/received` | seller | Pending blind offers for assets the caller holds |
| `GET /blind-offers/asset/:assetName` | public | Public pending blind offers for an asset |
| `PATCH /blind-offers/:id/withdraw` | buyer | Withdraw a pending blind offer |
| `PATCH /blind-offers/:id/reject` | seller | Reject a blind offer (validates seller holds the asset) |

### Key differences from Workflow 2

| | Workflow 2 | Workflow 3 |
|-|------------|------------|
| Who creates the listing? | Seller (before any offer) | App (atomically on acceptance) |
| When does the seller sign the PSBT? | Before listing is created | When accepting the blind offer |
| Offer status on creation | PENDING | ACCEPTED (immediately) |
| Discovery path for sellers | Seller monitors their listing | Seller monitors `/blind-offers/received` |

---

## Future Considerations

### Escrow
Not planned. All current workflows are fully atomic — asset and AVN swap in a
single transaction, leaving no delivery window that escrow would protect against.
Introducing escrow for only one side (e.g. AVN payment after asset transfer) would
be strictly worse than the atomic approach. If scope expands to cross-chain trades
or time-separated delivery this would need to be revisited.

### Auction
An auction is a listing variant, not a separate PSBT workflow. The PSBT completion
path is identical to Workflow 2 — once the auction closes, the winner follows the
same `funding-info` → `combine-psbt` → `complete` steps.

What an auction adds over a standard listing:
- `auctionEndAt` deadline and `minBidAvn` floor on the listing record
- The `expiry-watcher` (already in the indexer) auto-accepts the top PENDING offer
  when `auctionEndAt` passes, instead of the seller manually calling `PATCH /offers/:id/accept`
- All other bid and settlement logic is reused as-is

No new PSBT workflow is required. Implementation is a scheduling + auto-accept
concern scoped to the listings/offers services and the expiry-watcher.

---

## Security Notes

- The app server **never** holds private keys
- PSBTs are stored server-side only for coordination — they are always incomplete until the user signs
- Always call `decodepsbt` before signing to verify inputs/outputs
- Always call `testmempoolaccept` before `sendrawtransaction`
- Listings should have a TTL/expiry to prevent stale PSBTs accumulating
- Offers support an optional `ttlSeconds` field; expired offers should be treated as WITHDRAWN
- `SIGHASH_SINGLE|ANYONECANPAY` commits to input[index] and output[index] — the seller's input and payment output **must** remain at index 0 in the buyer's funded PSBT
- The binary PSBT injection used in `combine-psbt` is intentional: `combinepsbt` requires identical unsigned transactions, which is impossible when the buyer adds their own inputs/outputs
- **Direct wallet broadcast:** If a buyer obtains the combined PSBT and broadcasts it directly from their own wallet (bypassing `POST /offers/:id/complete`), the indexer will still detect the settlement on-chain — the seller's asset UTXO being spent triggers `detectOnChainSettlements()` in the block poller, which marks the listing `SOLD` and any accepted offer `COMPLETED`. However, if the broadcast happens with *no offer record in the app* (e.g. the buyer constructed and broadcast entirely outside the marketplace), the listing will be marked `SOLD` but no offer or buyer notification will exist. This is a known limitation of the coordinator model: the app can observe settlement but cannot reconstruct intent it was never told about.

---

## RPC Quick Reference

```bash
# Build listing PSBT (coordinator, unsigned)
avian-cli createpsbt '[{"txid":"<utxo>","vout":0}]' '[{"<sellerAddr>":50}]'

# Add UTXO data for external signing
avian-cli utxoupdatepsbt "<psbt_base64>"

# Seller signs (SINGLE|ANYONECANPAY) — commits to input[0] + output[0] only
avian-cli walletprocesspsbt "<psbt_base64>" true "SINGLE|ANYONECANPAY" false

# Buyer: build funding PSBT, seeding seller's UTXO at input[0]
avian-cli walletcreatefundedpsbt \
  '[{"txid":"<sellerInputTxid>","vout":<sellerInputVout>,"sequence":<seq>}]' \
  '[{"<sellerAddr>":<priceAvn>}]' \
  0 '{"add_inputs":true,"fee_rate":2}'

# NOTE: Do NOT use combinepsbt — PSBTs have different structures.
# Instead, POST /offers/:id/combine-psbt to inject the seller's sig via the API.

# Buyer signs combined PSBT (ALL — covers buyer's inputs only)
avian-cli walletprocesspsbt "<combined_psbt>" true "ALL" false

# Finalize + extract
avian-cli finalizepsbt "<signed_psbt>" true

# Test before broadcast
avian-cli testmempoolaccept '["<hex_tx>"]'

# Broadcast
avian-cli sendrawtransaction "<hex_tx>"
```
