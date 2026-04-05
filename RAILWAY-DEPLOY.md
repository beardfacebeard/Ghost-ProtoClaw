# Deploy Ghost ProtoClaw on Railway

## One-Click Deploy

Click the button below to deploy Ghost ProtoClaw + AI Runtimes + PostgreSQL in one step:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/lee6W8)

## What You Need (5 fields)

Railway will prompt you for these during setup:

| Field | Where to get it |
|---|---|
| **OPENROUTER_API_KEY** | Free at [openrouter.ai/keys](https://openrouter.ai/keys) — your AI provider key (one key, hundreds of models) |
| **RESEND_API_KEY** | Free at [resend.com/signup](https://resend.com/signup) — used for login emails |
| **MISSION_CONTROL_ADMIN_EMAIL** | Your email address (for logging in) |
| **MISSION_CONTROL_ADMIN_PASSWORD** | Choose a strong password |
| **MISSION_CONTROL_ADMIN_NAME** | Your name (optional) |

Everything else — database, secrets, runtime wiring — is handled automatically.

## Steps

1. Click the deploy button above.
2. Fill in the 5 fields when Railway asks.
3. Click **Deploy**.
4. Wait about 5 minutes for all services to build and start.
5. Open your Ghost ProtoClaw URL (shown in the Railway dashboard).
6. Log in with the email and password you chose.
7. Go to **Settings > API Keys** to verify your OpenRouter key is connected.
8. Start creating agents and testing them!

## What Gets Deployed

| Service | Purpose |
|---|---|
| **Ghost ProtoClaw** | Your AI control panel (Next.js app) |
| **OpenClaw** | AI runtime that executes agents and workflows |
| **Hermes** | Lightweight task runner for quick agent tasks |
| **Codex** | Code-focused orchestration runtime |
| **Claude Code** | Anthropic-specialized execution runtime |
| **PostgreSQL** | Database for all services |

All six services are wired together automatically. Secrets are generated, URLs are connected, and the database is seeded with your admin account on first boot.

## After Deployment

### First Things to Do

1. **Create your first business** — Go to Businesses > Create and give it a name.
2. **Create an agent** — Go to Agents > Create, pick a role (CEO, CMO, etc.), and select a model.
3. **Test your agent** — Open the agent and click "Test" to chat with it.
4. **Set a budget** — Go to Usage & Costs to monitor token spend.

### Model Recommendations

| Use Case | Recommended Model | Cost |
|---|---|---|
| General business tasks | Claude Sonnet 4.6 | ~$0.003/1K input |
| Complex analysis | Claude Opus 4.6 or GPT-5 | ~$0.015/1K input |
| Code generation | GPT-5.3 Codex or DeepSeek V3.2 | ~$0.01/1K input |
| Budget-friendly | DeepSeek V3.2 or Gemini 2.5 Flash | ~$0.0003/1K input |
| Free testing | Gemma 3 27B or GPT OSS 120B | Free |

### Optional: Add Direct Provider Keys

OpenRouter handles all models, but you can also add direct provider keys for potentially lower latency:

- **Settings > API Keys > Anthropic** — Direct Claude access
- **Settings > API Keys > OpenAI** — Direct GPT access
- **Settings > API Keys > Google** — Direct Gemini access

## Troubleshooting

| Problem | Solution |
|---|---|
| Build takes > 10 min | Check Railway build logs for missing env vars |
| Can't log in | Verify email/password in Railway env vars. Check service logs for seed errors |
| Agent test fails | Go to Settings > API Keys and verify OpenRouter is connected |
| Model timeout | Try a faster model (e.g., GPT-4o Mini, Claude Haiku 4.5) or increase timeout |
| "No AI provider configured" | Add your OpenRouter API key in Settings > API Keys |

## Local Development

```bash
# Clone the repo
git clone https://github.com/beardfacebeard/Ghost-ProtoClaw.git
cd Ghost-ProtoClaw

# Copy environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, OPENROUTER_API_KEY, etc.

# Install and setup
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

# Run locally
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the email/password from your `.env`.
