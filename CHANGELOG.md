# Changelog

All notable changes to the Ghost ProtoClaw stack — both the application and the Railway template — are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Template versions

The Railway template (public code `S9YZU-`) is a frozen snapshot. Each entry below corresponds to a snapshot I published via the Template Editor. If you deployed before a given date, you won't automatically pick up template-level changes — see [RAILWAY-DEPLOY.md § Staying Updated](./RAILWAY-DEPLOY.md#staying-updated).

### 2026-04-15 — Postgres bootable out of the box

**Fixed**

- Postgres service: `PGDATA` changed from `/var/lib/postgresql/data` to `/var/lib/postgresql/data/pgdata`. `initdb` refuses to use a mount root because Railway's volume root contains `lost+found`, so fresh deploys were crashing with `directory exists but is not empty`. Pinning `PGDATA` to a subdirectory lets initdb run.
- `scripts/start-production.mjs` now waits for the database to become reachable before running Prisma migrations, instead of burning retries against a cold DB. Helps with Railway cold-start races where the app container boots before Postgres accepts connections.

**Changed**

- The Railway template is now verified end-to-end: a fresh click-to-deploy brings all six services green without manual intervention.

### Earlier

- Continuous learning system across templates
- AI UGC Producer agent + UGC knowledge base in the TikTok Shop template
- Built-in Ad Clone Tool for TikTok Shop creative variation
- Three UGC workflows added to the TikTok Shop template (now 18 total)

See `git log` for commit-level history.

## Image pinning notes

| Image | Current tag | Notes |
|---|---|---|
| `ghcr.io/railwayapp-templates/postgres-ssl` | `17` (major-version pin) | Auto-major-upgrades would be dangerous. Bump the pin deliberately when a new major is needed. |
| `ghcr.io/openclaw/openclaw` | `latest` | OpenClaw is still in beta (as of 2026-04-15 the newest tag is `2026.4.15-beta.1`). Pinning to a beta date-tag locks deployers out of upstream bug fixes with no stable-release cadence to replace it. Leaving at `latest` so that clicking "Redeploy" on the OpenClaw service picks up the newest image. |

Last known-good OpenClaw image: `2026.4.15-beta.1` (tested end-to-end on 2026-04-15).
