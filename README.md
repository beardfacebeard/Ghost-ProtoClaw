# Ghost ProtoClaw Mission Control

> Complex tech. Invisible effort.

## What this is

Ghost ProtoClaw Mission Control is the private admin software that helps you run OpenClaw-powered businesses from one place. It is designed to turn complicated AI operations into guided setup steps, clear controls, and safe defaults. This repository is the product foundation: app shell, data models, configuration, and deployment setup.

## Quick Start: Railway

1. Create a new GitHub repo or push this project to a repo you control.
2. In Railway, create a new project and add a Postgres service if you are not using Supabase.
3. Copy `.env.example` to `.env`, then add the same values in Railway Variables.
4. Make sure the required values are filled in, especially `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `MAGIC_LINK_SECRET`, `ENCRYPTION_KEY`, and the owner account values.
5. Deploy the repo. Railway will use `railway.json` and start the app with `node scripts/start-production.mjs`.
6. After deploy, open `/api/admin/health` to confirm the service is live, then open the main app URL.

## Quick Start: Local Development

1. Install Node.js 22 and npm.
2. Copy `.env.example` to `.env` and fill in the required values.
3. Run `npm install`.
4. Run `npm run check:env` to see which required values are still missing.
5. Run `npm run db:generate` and then `npm run db:push`.
6. Run `npm run db:seed` if you want the default organization and owner user created from your env file.
7. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL where Mission Control is reachable. |
| `NEXT_PUBLIC_OPENCLAW_CONTROL_URL` | No | Optional public URL for the OpenClaw control surface. |
| `NEXT_PUBLIC_RAILWAY_TEMPLATE_URL` | No | Optional Railway template URL for Mission Control handoff. |
| `NEXT_PUBLIC_OPENCLAW_RAILWAY_TEMPLATE_URL` | No | Optional Railway template URL for OpenClaw Core handoff. |
| `MISSION_CONTROL_ADMIN_EMAIL` | Yes | Recovery owner email for the seed super admin. |
| `MISSION_CONTROL_ADMIN_PASSWORD` | Yes | Password for the seed super admin account. |
| `MISSION_CONTROL_ADMIN_NAME` | No | Display name for the owner and first seeded organization. |
| `SESSION_SECRET` | Yes | Primary secret used to sign session cookies and auth HMACs. |
| `MISSION_CONTROL_SESSION_SECRET` | No | Legacy alias for `SESSION_SECRET`. |
| `SESSION_MAX_AGE_DAYS` | No | Optional session lifetime override. |
| `MAGIC_LINK_SECRET` | Yes | Secret used to derive magic link verification tokens. |
| `RESEND_API_KEY` | Yes | Resend API key for login and invite emails. |
| `RESEND_FROM_EMAIL` | No | Preferred sender identity for auth emails. |
| `EMAIL_FROM` | No | Legacy alias for `RESEND_FROM_EMAIL`. |
| `DATABASE_URL` | Yes | Primary Postgres connection string. |
| `DIRECT_URL` | Yes | Direct Postgres connection string for Prisma schema work. |
| `POSTGRES_PASSWORD` | No | Password for the local Docker Postgres service. |
| `OPENCLAW_GATEWAY_URL` | Yes | Base URL of the OpenClaw gateway. |
| `OPENCLAW_GATEWAY_TOKEN` | No | Optional env-based gateway token. |
| `OPENCLAW_GATEWAY_TOKEN_FILE` | No | Optional path to a mounted gateway token file. |
| `OPENCLAW_WEBHOOK_SECRET` | Yes | Shared secret for verifying OpenClaw webhook events. |
| `OPENCLAW_WORKSPACE_ROOT` | Yes | Shared workspace root path used by Mission Control and OpenClaw. |
| `MISSION_CONTROL_WORKSPACE_MIRROR_MODE` | Yes | Whether workspace files mirror to `disk` or `database`. |
| `OPENCLAW_CLI_COMMAND` | Yes | Command used to invoke the OpenClaw CLI. |
| `ANTHROPIC_API_KEY` | No | Enables Anthropic model support. |
| `OPENROUTER_API_KEY` | No | Enables OpenRouter model support. |
| `OPENAI_API_KEY` | No | Enables direct OpenAI model support. |
| `MISSION_CONTROL_PROMPT_ASSIST_MODEL` | Yes | Default model slug used for prompt assistance and generation. |
| `ENCRYPTION_KEY` | Yes | Primary AES-256-GCM key for encrypting sensitive secrets. |
| `INTEGRATION_ENCRYPTION_KEY` | No | Legacy alias for `ENCRYPTION_KEY`. |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for notifications and approvals. |
| `TELEGRAM_ALLOWED_CHAT_IDS` | No | Allowed Telegram chat IDs. |
| `TELEGRAM_APPROVALS_CHANNEL_ID` | No | Telegram destination for approval alerts. |
| `GMAIL_CLIENT_ID` | No | Google OAuth client ID. |
| `GMAIL_CLIENT_SECRET` | No | Google OAuth client secret. |
| `GMAIL_REFRESH_TOKEN` | No | Optional Gmail refresh token. |
| `GHL_API_KEY` | No | GoHighLevel API key. |
| `GHL_LOCATION_ID` | No | GoHighLevel location ID. |
| `SKOOL_API_KEY` | No | Skool API key. |
| `SKOOL_COMMUNITY_URL` | No | Connected Skool community URL. |
| `STRIPE_SECRET_KEY` | No | Stripe secret key. |
| `STRIPE_WEBHOOK_SIGNING_SECRET` | No | Stripe webhook signing secret. |
| `EMERGENT_API_KEY` | No | Emergent API key. |
| `EMERGENT_PROJECT_SLUG` | No | Emergent project slug. |
| `WEB_SEARCH_PROVIDER` | No | Name of the web search provider. |
| `WEB_SEARCH_API_KEY` | No | API key for the web search provider. |
| `AWS_ACCESS_KEY_ID` | No | AWS access key ID for S3. |
| `AWS_SECRET_ACCESS_KEY` | No | AWS secret access key for S3. |
| `AWS_REGION` | No | AWS region for S3. |
| `AWS_S3_BUCKET` | No | S3 bucket name for uploads and exports. |
| `NIXPACKS_NODE_VERSION` | No | Node version override for Railway/Nixpacks. |
| `NODE_ENV` | No | Runtime mode such as `development` or `production`. |

## What is OpenClaw?

OpenClaw is the live AI runtime that actually powers the agents, workflows, channels, and automations. Ghost ProtoClaw does not replace OpenClaw. It gives you a cleaner control plane so you can configure, supervise, and deploy OpenClaw-powered businesses without living inside infrastructure tools.

## Getting Help

If something does not start, run `npm run check:env` first and fix any missing required values it reports. If the database schema looks out of sync, run `npm run db:generate` followed by `npm run db:push`. For deployments, start with Railway first, confirm the health endpoint works, and only then connect the rest of your integrations.
