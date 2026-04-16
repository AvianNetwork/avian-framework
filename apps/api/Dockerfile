# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/database/package.json        packages/database/package.json
COPY packages/avian-rpc/package.json       packages/avian-rpc/package.json
COPY packages/psbt-sdk/package.json        packages/psbt-sdk/package.json
COPY packages/shared/package.json          packages/shared/package.json
COPY apps/api/package.json                 apps/api/package.json
RUN npm ci --workspace=@avian-framework/api --include-workspace-root \
 && chmod +x node_modules/.bin/*

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/
# Build workspace packages first, then the api
RUN npx prisma generate --schema packages/database/prisma/schema.prisma
RUN npm run build --workspace=@avian-framework/database
RUN cp packages/database/src/generated/client/*.node packages/database/dist/generated/client/
RUN npm run build --workspace=@avian-framework/avian-rpc
RUN npm run build --workspace=@avian-framework/shared
RUN npm run build --workspace=@avian-framework/psbt-sdk
RUN npm run build --workspace=@avian-framework/api

# ── production ────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only production artifacts
COPY --from=builder /app/node_modules       ./node_modules
COPY --from=builder /app/packages/database/dist  ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/packages/avian-rpc/dist  ./packages/avian-rpc/dist
COPY --from=builder /app/packages/avian-rpc/package.json ./packages/avian-rpc/package.json
COPY --from=builder /app/packages/psbt-sdk/dist   ./packages/psbt-sdk/dist
COPY --from=builder /app/packages/psbt-sdk/package.json ./packages/psbt-sdk/package.json
COPY --from=builder /app/packages/shared/dist     ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist       ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/public     ./public
COPY --from=builder /app/package.json        ./package.json

EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
