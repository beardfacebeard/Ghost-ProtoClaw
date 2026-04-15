# Deploy Ghost ProtoClaw

Your AI business control panel can run anywhere — Railway (one click), a VPS (Docker or bare metal), or your local machine. Pick the method that fits your needs.

---

## Table of Contents

- [Option 1: Railway (Recommended)](#option-1-railway-recommended)
- [Option 2: VPS with Docker](#option-2-vps-with-docker)
- [Option 3: VPS without Docker (Bare Metal)](#option-3-vps-without-docker-bare-metal)
- [Option 4: Local Development](#option-4-local-development)
- [Understanding the Runtimes](#understanding-the-runtimes)
- [Environment Variables Reference](#environment-variables-reference)
- [After Deployment](#after-deployment)
- [Model Recommendations](#model-recommendations)
- [Troubleshooting](#troubleshooting)

---

## Option 1: Railway (Recommended)

Railway is the fastest way to deploy. One click, fill in 5 fields, and you're live in about 5 minutes.

### One-Click Deploy

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/lee6W8)

### What You Need (5 Fields)

Railway prompts you for these during setup. Everything else is auto-generated.

| Field | Where to Get It |
|---|---|
| **OPENROUTER_API_KEY** | Free at [openrouter.ai/keys](https://openrouter.ai/keys) — one key, hundreds of AI models |
| **RESEND_API_KEY** | Free at [resend.com/signup](https://resend.com/signup) — sends login emails |
| **MISSION_CONTROL_ADMIN_EMAIL** | Your email address (for logging in) |
| **MISSION_CONTROL_ADMIN_PASSWORD** | Choose a strong password |
| **MISSION_CONTROL_ADMIN_NAME** | Your name (optional, defaults to "Admin") |

### Steps

1. Click the deploy button above.
2. Fill in the 5 fields when Railway asks.
3. Click **Deploy**.
4. Wait about 5 minutes for all services to build and start.
5. Open your Ghost ProtoClaw URL (shown in the Railway dashboard).
6. Log in with the email and password you chose.
7. Go to **Settings > API Keys** to verify your OpenRouter key is connected.
8. Start creating agents!

### What Gets Deployed

| Service | Purpose |
|---|---|
| **Ghost ProtoClaw** | AI control panel (Next.js app) |
| **OpenClaw** | AI runtime — executes agents and workflows |
| **Hermes** | Lightweight task runner for quick agent tasks |
| **Codex** | Code-focused orchestration runtime |
| **Claude Code** | Anthropic-specialized execution runtime |
| **PostgreSQL** | Database for all services |

All six services are wired together automatically. Secrets are generated, URLs are connected, and the database is seeded with your admin account on first boot.

### Railway Costs

Railway's Hobby plan starts at $5/month and includes enough resources to run all six services. You pay for what you use beyond the included credits.

---

## Option 2: VPS with Docker

Run Ghost ProtoClaw on any VPS (DigitalOcean, Hetzner, Linode, Vultr, AWS EC2, etc.) using Docker.

### Requirements

- **OS:** Ubuntu 22.04+ or Debian 12+ (any Linux with Docker works)
- **RAM:** 2 GB minimum, 4 GB recommended
- **Storage:** 20 GB minimum
- **Ports:** 80 and 443 open for web traffic
- **Domain:** A domain name pointed at your server's IP (for HTTPS)

### Step 1: Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to the docker group (log out and back in after)
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verify
docker --version
docker compose version
```

### Step 2: Clone the Repository

```bash
cd /opt
sudo git clone https://github.com/beardfacebeard/Ghost-ProtoClaw.git
sudo chown -R $USER:$USER Ghost-ProtoClaw
cd Ghost-ProtoClaw
```

### Step 3: Configure Environment

```bash
cp .env.example .env
```

Open `.env` in your editor and set these required values:

```bash
# --- Required: Change these ---
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Admin account
MISSION_CONTROL_ADMIN_EMAIL="you@example.com"
MISSION_CONTROL_ADMIN_PASSWORD="your-strong-password"
MISSION_CONTROL_ADMIN_NAME="Your Name"

# Database (matches docker-compose.yml)
DATABASE_URL="postgresql://ghost:your-db-password@db:5432/ghost_protoclaw"
DIRECT_URL="postgresql://ghost:your-db-password@db:5432/ghost_protoclaw"
POSTGRES_PASSWORD="your-db-password"

# AI provider
OPENROUTER_API_KEY="sk-or-v1-your-key-here"

# Email
RESEND_API_KEY="re_your-key-here"

# --- Required: Generate these secrets ---
# Run each command and paste the output:
#   openssl rand -hex 32
SESSION_SECRET="paste-64-char-hex-here"
MAGIC_LINK_SECRET="paste-64-char-hex-here"
ENCRYPTION_KEY="paste-32-char-hex-here"

# OpenClaw gateway (generate these too)
#   openssl rand -hex 32
OPENCLAW_GATEWAY_TOKEN="paste-64-char-hex-here"
OPENCLAW_WEBHOOK_SECRET="paste-32-char-hex-here"

# OpenClaw URL (internal Docker network)
OPENCLAW_GATEWAY_URL="http://openclaw:8080"
```

> **Tip:** Generate all your secrets at once:
> ```bash
> echo "SESSION_SECRET=$(openssl rand -hex 32)"
> echo "MAGIC_LINK_SECRET=$(openssl rand -hex 32)"
> echo "ENCRYPTION_KEY=$(openssl rand -hex 16)"
> echo "OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)"
> echo "OPENCLAW_WEBHOOK_SECRET=$(openssl rand -hex 16)"
> ```

### Step 4: Create the Production Docker Compose

The included `docker-compose.yml` is minimal. For production with all services, create `docker-compose.prod.yml`:

```yaml
services:
  # --- Database ---
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: ghost_protoclaw
      POSTGRES_USER: ghost
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ghost -d ghost_protoclaw"]
      interval: 10s
      timeout: 5s
      retries: 5

  # --- Ghost ProtoClaw (Main App) ---
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      - SEED_ON_START=true
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy

  # --- OpenClaw (AI Runtime) ---
  openclaw:
    image: ghcr.io/openclaw/openclaw:latest
    volumes:
      - openclaw_data:/data
    environment:
      NODE_ENV: production
      OPENCLAW_GATEWAY_PORT: "8080"
      OPENCLAW_GATEWAY_TOKEN: ${OPENCLAW_GATEWAY_TOKEN}
      OPENCLAW_STATE_DIR: /data/.openclaw
      OPENCLAW_WORKSPACE_DIR: /data/workspace
      OPENCLAW_WEBHOOK_SECRET: ${OPENCLAW_WEBHOOK_SECRET}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
    restart: unless-stopped

  # --- Hermes (Task Runner) ---
  hermes:
    build: ./runtimes/shared
    environment:
      RUNTIME_ID: hermes
      API_KEY: ${RUNTIME_API_KEY:-default-runtime-key}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      DEFAULT_MODEL: anthropic/claude-sonnet-4-20250514
    restart: unless-stopped

  # --- Codex (Code Orchestration) ---
  codex:
    build: ./runtimes/shared
    environment:
      RUNTIME_ID: codex
      API_KEY: ${RUNTIME_API_KEY:-default-runtime-key}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      DEFAULT_MODEL: anthropic/claude-sonnet-4-20250514
    restart: unless-stopped

  # --- Claude Code (Anthropic Runtime) ---
  claude-code:
    build: ./runtimes/shared
    environment:
      RUNTIME_ID: claude-code
      API_KEY: ${RUNTIME_API_KEY:-default-runtime-key}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      DEFAULT_MODEL: anthropic/claude-sonnet-4-20250514
    restart: unless-stopped

volumes:
  pgdata:
  openclaw_data:
```

Add `RUNTIME_API_KEY` to your `.env`:

```bash
echo "RUNTIME_API_KEY=$(openssl rand -hex 16)" >> .env
```

### Step 5: Build and Start

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Watch the logs to make sure everything starts cleanly
docker compose -f docker-compose.prod.yml logs -f app
```

The app will:
1. Run database migrations automatically
2. Seed your admin account (first boot only)
3. Start the Next.js server on port 3000

Press `Ctrl+C` to stop watching logs (services keep running).

### Step 6: Set Up Nginx Reverse Proxy + SSL

Install Nginx and Certbot:

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create the Nginx config:

```bash
sudo tee /etc/nginx/sites-available/ghost-protoclaw > /dev/null << 'NGINX'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 50m;
    }
}
NGINX
```

Enable the site and get SSL:

```bash
# Enable the site
sudo ln -sf /etc/nginx/sites-available/ghost-protoclaw /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Get SSL certificate (replace with your domain and email)
sudo certbot --nginx -d your-domain.com --non-interactive --agree-tos -m you@example.com

# Certbot auto-renews, but verify:
sudo certbot renew --dry-run
```

Your app is now live at `https://your-domain.com`.

### Step 7: Set Up Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Verify
sudo ufw status
```

### Step 8: Auto-Start on Reboot

Docker services with `restart: unless-stopped` already restart on reboot if the Docker daemon is running. Make sure Docker starts on boot:

```bash
sudo systemctl enable docker
```

### Updating on a VPS

```bash
cd /opt/Ghost-ProtoClaw

# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Check logs
docker compose -f docker-compose.prod.yml logs -f app
```

### Backups

Back up your database regularly:

```bash
# One-time backup
docker compose -f docker-compose.prod.yml exec db pg_dump -U ghost ghost_protoclaw > backup-$(date +%Y%m%d).sql

# Set up daily backups with cron
sudo mkdir -p /opt/backups
(crontab -l 2>/dev/null; echo "0 3 * * * cd /opt/Ghost-ProtoClaw && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U ghost ghost_protoclaw > /opt/backups/ghost-protoclaw-\$(date +\%Y\%m\%d).sql") | crontab -
```

---

## Option 3: VPS without Docker (Bare Metal)

Run directly on the server without Docker. Useful if you already have a PostgreSQL instance or prefer managing Node.js directly.

### Requirements

- **OS:** Ubuntu 22.04+ or Debian 12+
- **Node.js:** 22.x
- **PostgreSQL:** 16.x
- **RAM:** 2 GB minimum
- **Domain:** Pointed at your server's IP

### Step 1: Install Node.js 22

```bash
# Install Node.js 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # should show v22.x
npm --version
```

### Step 2: Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create the database and user
sudo -u postgres psql << 'SQL'
CREATE USER ghost WITH PASSWORD 'your-db-password';
CREATE DATABASE ghost_protoclaw OWNER ghost;
GRANT ALL PRIVILEGES ON DATABASE ghost_protoclaw TO ghost;
SQL
```

### Step 3: Clone and Install

```bash
cd /opt
sudo git clone https://github.com/beardfacebeard/Ghost-ProtoClaw.git
sudo chown -R $USER:$USER Ghost-ProtoClaw
cd Ghost-ProtoClaw

npm install
npx prisma generate
```

### Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with the same values as the Docker guide above, except the database URL uses localhost:

```bash
DATABASE_URL="postgresql://ghost:your-db-password@localhost:5432/ghost_protoclaw"
DIRECT_URL="postgresql://ghost:your-db-password@localhost:5432/ghost_protoclaw"
```

Generate your secrets the same way:

```bash
echo "SESSION_SECRET=$(openssl rand -hex 32)"
echo "MAGIC_LINK_SECRET=$(openssl rand -hex 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 16)"
echo "OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)"
echo "OPENCLAW_WEBHOOK_SECRET=$(openssl rand -hex 16)"
echo "RUNTIME_API_KEY=$(openssl rand -hex 16)"
```

### Step 5: Build and Migrate

```bash
# Push schema to database
npx prisma db push

# Seed admin account
SEED_ON_START=true npx tsx prisma/seed.ts

# Build for production
npm run build
```

### Step 6: Create a Systemd Service

This keeps Ghost ProtoClaw running in the background and auto-restarts on crash or reboot.

```bash
sudo tee /etc/systemd/system/ghost-protoclaw.service > /dev/null << 'SERVICE'
[Unit]
Description=Ghost ProtoClaw AI Control Panel
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/Ghost-ProtoClaw
ExecStart=/usr/bin/node scripts/start-production.mjs
Restart=on-failure
RestartSec=10
EnvironmentFile=/opt/Ghost-ProtoClaw/.env
Environment=NODE_ENV=production
Environment=PORT=3000

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/Ghost-ProtoClaw

[Install]
WantedBy=multi-user.target
SERVICE
```

Replace `YOUR_USERNAME` with your actual Linux username.

```bash
# Reload systemd, enable, and start
sudo systemctl daemon-reload
sudo systemctl enable ghost-protoclaw
sudo systemctl start ghost-protoclaw

# Check status
sudo systemctl status ghost-protoclaw

# View logs
sudo journalctl -u ghost-protoclaw -f
```

### Step 7: Run the Runtime Services

Each runtime is a standalone Node.js server. Create a systemd service for each one:

```bash
# Install runtime dependencies
cd /opt/Ghost-ProtoClaw/runtimes/shared
# (no npm install needed — server.js has zero dependencies)

# Create Hermes service
sudo tee /etc/systemd/system/ghost-hermes.service > /dev/null << 'SERVICE'
[Unit]
Description=Ghost ProtoClaw - Hermes Runtime
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/Ghost-ProtoClaw/runtimes/shared
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=RUNTIME_ID=hermes
Environment=PORT=3010
Environment=DEFAULT_MODEL=anthropic/claude-sonnet-4-20250514
EnvironmentFile=/opt/Ghost-ProtoClaw/.env

[Install]
WantedBy=multi-user.target
SERVICE

# Create Codex service
sudo tee /etc/systemd/system/ghost-codex.service > /dev/null << 'SERVICE'
[Unit]
Description=Ghost ProtoClaw - Codex Runtime
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/Ghost-ProtoClaw/runtimes/shared
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=RUNTIME_ID=codex
Environment=PORT=3011
Environment=DEFAULT_MODEL=anthropic/claude-sonnet-4-20250514
EnvironmentFile=/opt/Ghost-ProtoClaw/.env

[Install]
WantedBy=multi-user.target
SERVICE

# Create Claude Code service
sudo tee /etc/systemd/system/ghost-claude-code.service > /dev/null << 'SERVICE'
[Unit]
Description=Ghost ProtoClaw - Claude Code Runtime
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/opt/Ghost-ProtoClaw/runtimes/shared
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=RUNTIME_ID=claude-code
Environment=PORT=3012
Environment=DEFAULT_MODEL=anthropic/claude-sonnet-4-20250514
EnvironmentFile=/opt/Ghost-ProtoClaw/.env

[Install]
WantedBy=multi-user.target
SERVICE
```

Replace `YOUR_USERNAME` in each file, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ghost-hermes ghost-codex ghost-claude-code
sudo systemctl start ghost-hermes ghost-codex ghost-claude-code

# Verify all three are running
sudo systemctl status ghost-hermes ghost-codex ghost-claude-code
```

### Step 8: Set Up Nginx + SSL

Same as the Docker section above — install Nginx and Certbot, create the site config, and get your SSL certificate. The proxy_pass target is the same (`http://127.0.0.1:3000`).

### Step 9: Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Updating (Bare Metal)

```bash
cd /opt/Ghost-ProtoClaw
git pull origin main
npm install
npx prisma generate
npx prisma db push
npm run build
sudo systemctl restart ghost-protoclaw ghost-hermes ghost-codex ghost-claude-code
```

---

## Option 4: Local Development

Run Ghost ProtoClaw on your own machine for development or testing.

### Requirements

- **Node.js:** 22.x
- **PostgreSQL:** 16.x (or use Docker for just the database)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/beardfacebeard/Ghost-ProtoClaw.git
cd Ghost-ProtoClaw

# Copy and configure environment variables
cp .env.example .env
# Edit .env — at minimum set:
#   DATABASE_URL, DIRECT_URL, OPENROUTER_API_KEY, RESEND_API_KEY,
#   MISSION_CONTROL_ADMIN_EMAIL, MISSION_CONTROL_ADMIN_PASSWORD,
#   SESSION_SECRET, MAGIC_LINK_SECRET, ENCRYPTION_KEY

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed admin account
npx tsx prisma/seed.ts

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the email and password from your `.env`.

### Using Docker for Just the Database

If you don't want to install PostgreSQL locally:

```bash
# Start only the database
docker compose up -d db

# Your DATABASE_URL would be:
# postgresql://ghost:change-me@localhost:5432/ghost_protoclaw
```

Then run `npm run dev` as normal on your host machine.

---

## Understanding the Runtimes

Ghost ProtoClaw uses a multi-runtime architecture. The main app is your control panel — it manages agents, businesses, workflows, and settings. The runtimes are the engines that actually execute AI work. Think of Ghost ProtoClaw as the brain and the runtimes as the hands.

### Architecture Overview

```
You (Browser)
  |
  v
Ghost ProtoClaw (Next.js app — port 3000)
  |
  |--- OpenClaw (primary AI runtime — port 8080)
  |--- Hermes (lightweight task runner — port 3010)
  |--- Codex (code-focused runtime — port 3011)
  |--- Claude Code (Anthropic-specialized — port 3012)
  |
  v
OpenRouter API --> AI Models (Claude, GPT, Gemini, DeepSeek, etc.)
```

When you test an agent or trigger a workflow, Ghost ProtoClaw sends the request to one of these runtimes, which then calls the AI model through OpenRouter and returns the result.

### The Runtimes Explained

#### OpenClaw — The Primary Runtime

**What it does:** OpenClaw is the main AI execution engine. It handles agent conversations, workflow orchestration, tool execution, and multi-step reasoning. When you click "Test" on an agent or a workflow fires, OpenClaw is what processes it.

**When to use it:** Always. OpenClaw is the default runtime and handles the vast majority of your work. Every deployment should include it.

**Best for:**
- Agent conversations and testing
- Workflow execution (scheduled, triggered, or manual)
- Multi-step agent tasks that require tool use
- Any general-purpose AI work

**Technical details:** Runs as a Docker container (`ghcr.io/openclaw/openclaw:latest`) with its own persistent storage for state and workspace files. Communicates with Ghost ProtoClaw via an authenticated HTTP API (OpenAI-compatible format).

#### Hermes — The Fast Task Runner

**What it does:** Hermes is a lightweight, zero-dependency Node.js server designed for quick, single-turn tasks. It's optimized for speed — no state management, no tool orchestration, just fast in-and-out AI calls.

**When to use it:** When you need quick, simple agent tasks that don't require multi-step reasoning or tools. Hermes is ideal for hooks, triggers, and automation steps where speed matters more than depth.

**Best for:**
- Quick classification or triage tasks ("Is this email urgent?")
- Simple text generation (drafting a short response, summarizing a paragraph)
- Webhook-triggered actions that need fast turnaround
- Workflow steps that feed into other steps (get an answer, pass it along)
- Heartbeat checks and health monitoring tasks
- Any task where the agent just needs to read input and produce output — no browsing, no file access, no multi-turn conversation

**When NOT to use it:** Don't use Hermes for complex tasks that require tool use, memory, multi-step reasoning, or long conversations. Use OpenClaw for those.

**Technical details:** Runs from `runtimes/shared/server.js` with `RUNTIME_ID=hermes`. Has zero npm dependencies — it's a raw Node.js HTTP server that proxies requests to OpenRouter. Endpoints: `/v1/chat/completions` (OpenAI-compatible), `/hooks/agent` (simplified hook format).

#### Codex — The Code Specialist

**What it does:** Codex is a code-focused runtime that handles development and technical tasks. It uses the same lightweight server as Hermes but with a system prompt tuned for code generation, analysis, and technical problem-solving.

**When to use it:** When your agents need to produce code, analyze technical problems, or handle development-oriented tasks. If you're running the SaaS Product template or any business with a CTO/Builder agent, Codex is what powers their technical work.

**Best for:**
- Code generation and refactoring
- Technical architecture analysis
- Bug analysis and debugging
- API integration planning
- Database schema design
- Technical documentation writing
- Any agent with a CTO, Developer, or Builder role

**When NOT to use it:** Don't use Codex for non-technical tasks like marketing copy, sales outreach, or general business strategy. Use OpenClaw or Hermes for those.

**Technical details:** Runs from `runtimes/shared/server.js` with `RUNTIME_ID=codex`. Uses the `/orchestrate` endpoint which wraps requests with a code-focused system prompt. Default model: `anthropic/claude-sonnet-4-20250514`.

#### Claude Code — The Anthropic Specialist

**What it does:** Claude Code is an execution runtime optimized for Anthropic's Claude models. It's designed for tasks that benefit from Claude's specific strengths — nuanced reasoning, careful instruction-following, and detailed analysis.

**When to use it:** When you want to ensure tasks are routed specifically through Claude models with prompting optimized for Claude's style. This is especially useful for the Ghost Operator template where agents handle sensitive business decisions that require careful, thorough reasoning.

**Best for:**
- Complex business analysis and strategy
- Sensitive decision-making (hiring, budget allocation, risk assessment)
- Long-form content that requires nuance and depth
- Tasks requiring careful instruction-following
- Ghost Operator CEO/Scout and COO/Strategist agents
- Any task where reasoning quality matters more than speed

**When NOT to use it:** Don't use Claude Code for quick, simple tasks where speed matters — Hermes is faster. Don't use it if you primarily use non-Anthropic models (GPT, Gemini, DeepSeek) — the system prompting is tuned for Claude.

**Technical details:** Runs from `runtimes/shared/server.js` with `RUNTIME_ID=claude-code`. Uses the `/execute` endpoint with a Claude-optimized system prompt. Default model: `anthropic/claude-sonnet-4-20250514`.

### Which Runtime Should I Use?

For most users, here's the simple answer:

| Your Situation | What to Run |
|---|---|
| **Just getting started** | OpenClaw only — it handles everything |
| **Running workflows with automation** | OpenClaw + Hermes (Hermes handles the quick automated steps) |
| **Building software or technical products** | OpenClaw + Codex (Codex handles code tasks) |
| **Using the Ghost Operator template** | All four — each agent maps to the runtime that matches its role |
| **Want maximum flexibility** | All four — the system routes tasks to the best runtime |

### Do I Need All Four Runtimes?

**No.** OpenClaw alone can handle everything. The other three runtimes are specialized — they make specific types of tasks faster or better, but they're not required.

If you're on a small VPS or want to keep things simple, just run Ghost ProtoClaw + OpenClaw + PostgreSQL. That's three services and it covers 100% of functionality.

Add Hermes when you start building automated workflows and want faster execution for simple tasks. Add Codex when your agents are doing technical/code work. Add Claude Code when you want Claude-optimized execution for high-stakes decisions.

### Runtime Quick Reference

| Runtime | Port | Endpoint | Speed | Depth | Best For |
|---|---|---|---|---|---|
| **OpenClaw** | 8080 | `/v1/chat/completions` | Medium | Deep | Everything (default) |
| **Hermes** | 3010 | `/hooks/agent` | Fast | Shallow | Quick tasks, hooks, triggers |
| **Codex** | 3011 | `/orchestrate` | Medium | Deep | Code, technical analysis |
| **Claude Code** | 3012 | `/execute` | Medium | Deep | Nuanced reasoning, sensitive decisions |

---

## Environment Variables Reference

The full list lives in `.env.example` with detailed comments. Here's a summary of what's required vs optional.

### Required for All Deployments

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct (non-pooled) PostgreSQL connection string |
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `RESEND_API_KEY` | Your Resend API key for login emails |
| `MISSION_CONTROL_ADMIN_EMAIL` | Admin login email |
| `MISSION_CONTROL_ADMIN_PASSWORD` | Admin login password |
| `SESSION_SECRET` | 64-char hex string for session signing |
| `MAGIC_LINK_SECRET` | 64-char hex string for magic link tokens |
| `ENCRYPTION_KEY` | 32-char hex string for AES-256 encryption |
| `NEXT_PUBLIC_APP_URL` | Public URL of your app (e.g. `https://your-domain.com`) |

### Required for AI Runtimes

| Variable | Description |
|---|---|
| `OPENCLAW_GATEWAY_URL` | URL of your OpenClaw instance |
| `OPENCLAW_GATEWAY_TOKEN` | Bearer token shared with OpenClaw |
| `OPENCLAW_WEBHOOK_SECRET` | Webhook signing secret shared with OpenClaw |

### Optional

| Variable | Description |
|---|---|
| `MISSION_CONTROL_ADMIN_NAME` | Display name for admin (default: "Admin") |
| `ANTHROPIC_API_KEY` | Direct Anthropic access (bypasses OpenRouter) |
| `OPENAI_API_KEY` | Direct OpenAI access (bypasses OpenRouter) |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications and approvals |
| `STRIPE_SECRET_KEY` | Stripe billing integration |
| `GHL_API_KEY` | GoHighLevel CRM integration |
| `SKOOL_API_KEY` | Skool community integration |

See `.env.example` for the complete list with descriptions.

---

## After Deployment

### First Things to Do

1. **Create your first business** — Go to Businesses > Create and give it a name. Pick a template that matches your use case (see [TEMPLATE-GUIDE.md](./TEMPLATE-GUIDE.md) for details on all 13 templates).
2. **Create an agent** — Go to Agents > Create, pick a role (CEO, CMO, Support Lead, etc.), and select a model.
3. **Test your agent** — Open the agent and click "Test" to have a conversation. Try asking it to help with a real business task.
4. **Set a budget** — Go to Usage & Costs to monitor token spend and set monthly limits.

### Optional: Add Direct Provider Keys

OpenRouter handles all models, but you can also add direct provider keys for potentially lower latency:

- **Settings > API Keys > Anthropic** — Direct Claude access
- **Settings > API Keys > OpenAI** — Direct GPT access
- **Settings > API Keys > Google** — Direct Gemini access

---

## Model Recommendations

| Use Case | Recommended Model | Cost |
|---|---|---|
| General business tasks | Claude Sonnet 4.6 | ~$0.003/1K input |
| Complex analysis | Claude Opus 4.6 or GPT-5 | ~$0.015/1K input |
| Code generation | GPT-5.3 Codex or DeepSeek V3.2 | ~$0.01/1K input |
| Budget-friendly | DeepSeek V3.2 or Gemini 2.5 Flash | ~$0.0003/1K input |
| Free testing | Gemma 3 27B or GPT OSS 120B | Free |

> **Tip:** Only need one API key! OpenRouter gives you access to OpenAI, Anthropic, Google, DeepSeek, and hundreds more models through a single API key. Start with free models and upgrade anytime at [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Troubleshooting

### General

| Problem | Solution |
|---|---|
| Can't log in | Verify email/password in your `.env` or Railway env vars. Check service logs for seed errors. |
| Agent test fails | Go to Settings > API Keys and verify OpenRouter is connected. |
| Model timeout | Try a faster model (e.g., GPT-4o Mini, Claude Haiku 4.5) or increase the agent's max tokens. |
| "No AI provider configured" | Add your OpenRouter API key in Settings > API Keys. |

### Railway

| Problem | Solution |
|---|---|
| Build takes > 10 min | Check Railway build logs for missing env vars. |
| Service won't start | Check the Deployments tab for crash logs. Common cause: missing `DATABASE_URL`. |
| Deploy log shows "required environment variables are missing" | The template didn't auto-generate the expected secrets. Open the Ghost ProtoClaw service → Variables tab and add the variables listed in the error (each generated with `openssl rand -hex 32` or `openssl rand -hex 16`, matching the byte count in the hint). Then click **Redeploy**. |
| Login page loads but sign-in returns 500 | Almost always a missing `SESSION_SECRET`, `MAGIC_LINK_SECRET`, or `ENCRYPTION_KEY`. Starting from this build, the service fails fast at boot with a clear list of missing vars — check the deploy log. |
| Using a stale template snapshot | Railway caches the published template. If you deployed before this fix and see the issues above, redeploy fresh from the button in this README so you pick up the latest template. |

### VPS / Docker

| Problem | Solution |
|---|---|
| `docker compose up` fails | Make sure Docker Compose v2 is installed (`docker compose version`). |
| Database connection refused | Check that the `db` container is running: `docker compose ps`. Wait for the healthcheck to pass. |
| Port 3000 not accessible | Check firewall: `sudo ufw status`. Make sure Nginx is proxying to 3000. |
| SSL certificate fails | Make sure your domain's DNS A record points to your server IP. Run `certbot` again. |
| Containers use too much memory | Add memory limits to `docker-compose.prod.yml` under each service. |
| Permission denied on `/opt` | Make sure you own the directory: `sudo chown -R $USER:$USER /opt/Ghost-ProtoClaw`. |

### Bare Metal

| Problem | Solution |
|---|---|
| `npx prisma db push` fails | Check that PostgreSQL is running: `sudo systemctl status postgresql`. Verify `DATABASE_URL` is correct. |
| Service won't start via systemd | Check logs: `sudo journalctl -u ghost-protoclaw -n 50`. Common cause: wrong `User=` or missing `.env` file. |
| Node.js version wrong | Verify with `node --version`. Must be 22.x. Reinstall via NodeSource if needed. |

### Logs

```bash
# Railway: Check the Deployments tab in the Railway dashboard

# Docker:
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f openclaw

# Systemd:
sudo journalctl -u ghost-protoclaw -f
sudo journalctl -u ghost-hermes -f
```
