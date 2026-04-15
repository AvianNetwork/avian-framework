# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app

# ── deps ─────────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json   packages/shared/package.json
COPY apps/web/package.json          apps/web/package.json
RUN npm ci --workspace=@avian-framework/web --include-workspace-root \
 && chmod +x node_modules/.bin/*

# ── build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars must be baked in at build time — Next.js embeds them into
# the client bundle during `next build`. Accept them as build ARGs.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/
RUN npm run build --workspace=@avian-framework/shared
RUN npm run build --workspace=@avian-framework/web

# ── production ────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public                    ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static     ./apps/web/.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "apps/web/server.js"]
