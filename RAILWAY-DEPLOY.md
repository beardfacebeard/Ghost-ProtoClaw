# Deploy Ghost ProtoClaw on Railway

## One-Click Deploy

Click the button below to deploy Ghost ProtoClaw + OpenClaw + PostgreSQL in one step:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/TEMPLATE_ID)

> **Brandon (owner):** Replace `TEMPLATE_ID` above after publishing your template. See the instructions at the bottom of this file.

## What You Need (5 fields)

Railway will prompt you for these during setup:

| Field | Where to get it |
|---|---|
| **RESEND_API_KEY** | Free at [resend.com/signup](https://resend.com/signup) — used for login emails |
| **OPENROUTER_API_KEY** | Free at [openrouter.ai/keys](https://openrouter.ai/keys) — your AI provider key |
| **MISSION_CONTROL_ADMIN_EMAIL** | Your email address (for logging in) |
| **MISSION_CONTROL_ADMIN_PASSWORD** | Choose a strong password |
| **MISSION_CONTROL_ADMIN_NAME** | Your name (optional) |

Everything else — database, secrets, service wiring — is handled automatically.

## Steps

1. Click the deploy button above.
2. Fill in the 5 fields when Railway asks.
3. Click **Deploy**.
4. Wait about 5 minutes for both services to build and start.
5. Open your Ghost ProtoClaw URL (shown in the Railway dashboard).
6. Log in with the email and password you chose.

That's it. You're live.

## What Gets Deployed

| Service | Purpose |
|---|---|
| **Ghost ProtoClaw** | Your AI control panel (this app) |
| **OpenClaw** | AI runtime that executes agents and workflows |
| **PostgreSQL** | Database for both services |

All three services are wired together automatically. Secrets are generated, URLs are connected, and the database is seeded with your admin account on first boot.

## Troubleshooting

- **Build takes longer than 10 minutes?** Check the Railway build logs for errors. The most common issue is a missing environment variable.
- **Can't log in?** Make sure you entered the correct email and password during setup. Check the Ghost ProtoClaw service logs for seed errors.
- **OpenClaw not connecting?** Verify both services are running in the Railway dashboard. The webhook secret is shared automatically.

---

## For Brandon Only — How to Get Your TEMPLATE_ID

This section is for you (the product owner), not for customers. Do this once, then delete this section before distributing.

### Step-by-step:

1. **Push this repo to GitHub**
   - Go to github.com/new
   - Create a **private** repo named `ghost-protoclaw`
   - Push this entire folder to it

2. **Make sure the repo is set to public (or Railway-accessible)**
   - Railway needs to read your repo to build the template
   - Go to your repo Settings → change visibility to Public (you can make it private again later if you use Railway's GitHub integration)

3. **Publish the template on Railway**
   - Go to: **https://railway.com/account/templates**
   - Click **"Create Template"**
   - Select your `beardfacebeard/ghost-protoclaw` repo
   - Railway reads your `railway-template.json` and builds the template automatically
   - Fill in the template name: `Ghost ProtoClaw + OpenClaw`
   - Fill in the description: `One-click deploy for Ghost ProtoClaw AI control panel + OpenClaw runtime + PostgreSQL`
   - Click **Publish**

4. **Copy your Template ID**
   - After publishing, Railway takes you to your template page
   - The URL will look like: `https://railway.com/template/AbCdEf`
   - That last part (`AbCdEf`) is your TEMPLATE_ID

5. **Paste it into this file**
   - Replace `TEMPLATE_ID` in the deploy button URL at the top of this file with your actual ID
   - Example: `https://railway.com/template/AbCdEf`

6. **Delete this entire "For Brandon Only" section** before giving this file to customers

7. **Commit and push** — your deploy button is now live
