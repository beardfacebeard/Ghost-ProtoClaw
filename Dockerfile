# syntax=docker/dockerfile:1.7
#
# Multi-stage build for Ghost ProtoClaw Mission Control.
#
# Stages:
#   1. deps    — install node_modules and generate the Prisma client. Isolated
#                so npm ci only reruns when package*.json or the Prisma schema
#                actually changes.
#   2. builder — compile the Next.js app. Reuses node_modules from `deps`.
#   3. runner  — minimal runtime image. Copies the build output and
#                dependencies, drops privileges to the non-root `node` user,
#                and adds a Docker HEALTHCHECK hitting /api/admin/health.
#
# Notes:
# - We do NOT prune devDependencies in the runner. The production boot script
#   (scripts/start-production.mjs) invokes the Prisma CLI and, when seeding is
#   enabled, `tsx prisma/seed.ts` — both live in devDependencies.
# - Prisma engine binaries are platform-specific. Running `prisma generate`
#   inside alpine ensures the linux-musl engine is fetched and baked into the
#   image.
# - Signals: start-production.mjs installs its own SIGTERM/SIGINT handlers and
#   forwards them to the Next child, so we don't need tini/dumb-init as PID 1.

# ─── Stage 1: deps ───────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma

# --ignore-scripts: don't run third-party lifecycle hooks during install.
# We generate the Prisma client ourselves in the next step so we control
# exactly when and against which schema it happens.
RUN npm ci --no-audit --no-fund --ignore-scripts \
 && npx prisma generate

# ─── Stage 2: builder ────────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─── Stage 3: runner ─────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production \
    SEED_ON_START=false \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    PATH="/app/node_modules/.bin:$PATH"

# The node:alpine image ships with a non-root `node` user (uid 1000). We
# --chown during COPY so the runtime user actually owns its own files and
# Next.js can write to .next/cache without escalating.
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/next.config.mjs ./next.config.mjs

USER node

EXPOSE 3000

# Readiness probe for Docker / Compose / Kubernetes. Railway has its own
# platform-level healthcheck configured in railway.json that points at the
# same path — this is additional defense-in-depth for non-Railway deploys.
# Uses Node's built-in fetch (Node 18+) so we don't need curl or wget in the
# runtime image. A 5xx (including the 503 returned by the health route when
# secrets or the database are unreachable) marks the container unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/admin/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "scripts/start-production.mjs"]
