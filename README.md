# Avian PSBT Marketplace

A non-custodial PSBT-based asset marketplace and SDK for the
[Avian blockchain](https://avn.network).

This repo is two things:
- **`@avian-framework/psbt-sdk` and `@avian-framework/avian-rpc`** — reusable packages for anyone building PSBT
  workflows on Avian (CLI tools, desktop wallets, mobile apps, other marketplaces)
- **`apps/`** — a full reference marketplace implementation using those packages

---

## Packages

| Package | Description | Publishable |
|---------|-------------|-------------|
| `@avian-framework/psbt-sdk` | PSBT workflow builder + validator | Yes |
| `@avian-framework/avian-rpc` | Typed Avian Core RPC client | Yes |
| `@avian-framework/shared` | Domain types, enums, constants | Yes |
| `@avian-framework/database` | Prisma schema + generated client (app-specific) | No |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 + Tailwind CSS |
| Backend API | NestJS + TypeScript |
| Database | PostgreSQL + Prisma |
| Cache / Queue | Redis |
| Chain Indexer | Node.js TypeScript service |
| Wallet | Avian Core 5.0.0 JSON-RPC (PSBT) |
| Containers | Docker Compose |

## Monorepo Layout

```
apps/
  web/        Next.js marketplace UI
  api/        NestJS REST + WebSocket API
  indexer/    Chain watcher / block indexer

packages/
  avian-rpc/  Typed Avian Core RPC client
  psbt-sdk/   PSBT workflow builder + state machine
  database/   Prisma schema + generated client
  shared/     Domain types, enums, constants

docker/       Docker Compose dev stack
docs/         PSBT workflow spec + guides
```

## Features

- **Asset marketplace** — list Avian assets for sale; buyers browse and make offers
- **Blind offers** — buyers make open offers on an asset without a specific listing
- **Non-custodial PSBT execution** — atomic asset + AVN swap; no private keys server-side
- **User profiles** — usernames, avatars, bio, linked wallets, sale history
- **Collections** — group assets under a named collection with cover art and description
- **Watch users** — follow an address and get notified when they create a new listing
- **Notifications** — in-app + real-time WebSocket push for offers, listings, expiry
- **Marketplace stats** — floor price, total volume, last sale; filterable by asset
- **Search & filters** — filter by asset name, price range; sort by newest/oldest/price
- **Expiry system** — listings and offers expire; 24-hour advance warning notifications
- **Asset metadata** — off-chain title, description, traits, IPFS image support
- **Swagger UI** — full API documentation at `/api/docs`

---

## Quick Start (Development)

### Prerequisites

- Node.js 24+
- Docker + Docker Compose

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD, JWT_SECRET, AVIAN_RPC_USER, AVIAN_RPC_PASS at minimum
```

### 3. Start infrastructure (Postgres + Redis)

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d postgres redis
```

### 4. Run Prisma migrations

```bash
npm run db:migrate
```

### 5. Start all services

```bash
npm run dev
```

Services:
- Web:     http://localhost:3000
- API:     http://localhost:4000
- Swagger: http://localhost:4000/api/docs

> **Avian Core node:** For development you can connect to an existing node by setting `AVIAN_RPC_URL`,
> `AVIAN_RPC_USER`, and `AVIAN_RPC_PASS` in `.env`. See [Deployment](#deployment) for running
> the node in Docker.

---

## Deployment

All services ship as Docker images and are orchestrated with a single Compose file.
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
is used for ingress — no ports need to be exposed on the host.

### 1. Configure environment

```bash
cp .env.example .env
# Fill in all values — see .env.example for descriptions
```

### 2. Build images

```bash
# Run from repo root
docker compose --env-file .env -f docker/docker-compose.yml build
```

### 3. Run Prisma migrations

```bash
# Start only Postgres, then run migrations from the API container
docker compose --env-file .env -f docker/docker-compose.yml up -d postgres
docker compose --env-file .env -f docker/docker-compose.yml run --rm api \
  npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

### 4. Start the full stack

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

Services started:
| Service | Description |
|---------|-------------|
| `postgres` | PostgreSQL 16 |
| `redis` | Redis 7 |
| `avian-node` | Avian Core 5.0.0 daemon (syncs full chain on first run) |
| `api` | NestJS API on port 3001 — waits for `avian-node` to be healthy |
| `indexer` | Block indexer + expiry watcher — waits for `avian-node` to be healthy |
| `web` | Next.js frontend on port 3000 |
| `cloudflared` | Cloudflare Tunnel — routes public traffic to `web` and `api` |

### 4. Cloudflare Tunnel ingress

Create a tunnel at [dash.cloudflare.com → Zero Trust → Networks → Tunnels](https://dash.cloudflare.com/one/),
copy the token to `CLOUDFLARE_TUNNEL_TOKEN` in `.env`, then configure ingress rules in the dashboard:

| Hostname | Service |
|----------|---------|
| `yourdomain.com` | `http://web:3000` |
| `api.yourdomain.com` | `http://api:3001` |

### Notes

- The Avian node data persists in the `avian_data` Docker volume. Initial chain sync takes several hours.
- All Compose builds use `..` (repo root) as context — always run `docker compose` from the repo root
  with `--env-file .env -f docker/docker-compose.yml`. The `--env-file` flag is required because Docker
  Compose v2 resolves `.env` relative to the compose file's directory (`docker/`), not the repo root.
- Postgres and Redis ports are **not** exposed to the host in production.

### Useful Docker commands

```bash
# Shorthand for all compose commands
DC="docker compose --env-file .env -f docker/docker-compose.yml"

# View logs
$DC logs -f api
$DC logs -f indexer
$DC logs -f avian-node

# Avian Core RPC (via the running container)
AVIAN_CLI="$DC exec avian-node avian-cli -datadir=/avian/.avian"
$AVIAN_CLI getblockchaininfo      # sync progress, chain height, best block
$AVIAN_CLI getnetworkinfo          # peer count, version, connections
$AVIAN_CLI getmempoolinfo          # mempool size & tx count
$AVIAN_CLI getblockcount            # current block height
$AVIAN_CLI listassets "*" true      # all issued assets with metadata
$AVIAN_CLI getpeerinfo              # connected peers

# Database
$DC exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB    # open psql shell
```

---

## PSBT Workflow

See [docs/psbt-workflow-spec.md](docs/psbt-workflow-spec.md) for the full spec.

**Listing flow (sell asset for AVN):**

1. Seller calls `POST /psbt/build/listing` → receives unsigned PSBT
2. Seller signs with `walletprocesspsbt "<PSBT>" true "SINGLE|FORKID|ANYONECANPAY"` in Avian Core
3. Seller submits signed PSBT to `POST /listings` → stored as active listing
4. Buyer calls `GET /offers/:id/funding-info` → gets seller UTXO details
5. Buyer builds funding PSBT with `walletcreatefundedpsbt` and submits to `POST /offers/:id/combine-psbt`
6. Buyer signs combined PSBT with `walletprocesspsbt "..." true "ALL|FORKID"` and submits to `POST /offers/:id/complete`
7. API finalizes, validates with `testmempoolaccept`, and broadcasts
8. Indexer confirms on-chain → listing marked SOLD, notifications sent

**Blind offer flow (buy without a specific listing):**

1. Buyer creates blind offer via `POST /blind-offers` — specifies asset, amount, price
2. Seller sees the offer on their asset and calls `POST /blind-offers/:id/accept` with their signed PSBT
3. API combines PSBTs, broadcasts, and both parties are notified

---

## API Overview

All routes are prefixed with `/api/v1`. Full interactive documentation is available at `/api/docs`.

| Tag | Key Routes |
|-----|-----------|
| `auth` | `POST /auth/challenge` · `POST /auth/verify` |
| `assets` | `GET /assets` · `GET /assets/:name` · `GET /assets/:name/holders` |
| `listings` | `GET /listings` · `POST /listings` · `GET /listings/:id` · `PATCH /listings/:id/cancel` |
| `listings` | `GET /listings/stats` · `GET /listings/sales/by-address` |
| `offers` | `POST /offers` · `PATCH /offers/:id/accept` · `POST /offers/:id/combine-psbt` · `POST /offers/:id/complete` |
| `blind-offers` | `POST /blind-offers` · `GET /blind-offers/received` · `POST /blind-offers/:id/accept` |
| `psbt` | `POST /psbt/build/listing` · `POST /psbt/decode` · `POST /psbt/submit` |
| `users` | `GET /users/:username` · `PATCH /users/me` · `POST /users/me/link-wallet` |
| `notifications` | `GET /notifications` · `PATCH /notifications/:id/read` |
| `watches` | `POST /watches/:address` · `DELETE /watches/:address` |
| `collections` | `POST /collections` · `GET /collections/:slug` |

---

## Architecture Principles

- **Non-custodial** — no private keys server-side, ever
- **Atomic** — asset and payment settle in one transaction
- **Coordinator pattern** — app builds and tracks PSBTs; wallets sign
- **Portable spec** — `psbt-sdk` package is usable from CLI, desktop, mobile
- **Event-driven** — indexer publishes Redis events; API delivers via WebSocket

---

## License

MIT

