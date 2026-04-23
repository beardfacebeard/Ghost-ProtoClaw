# TipTax Affiliate Engine — Complete Setup Guide

Private template for operator `beardfacebeard@gmail.com`. Every step below is a one-time setup; once done, the agent workforce runs continuously.

---

## Prerequisites checklist

- [ ] Railway deploy is green on commit `eb9194d` or later
- [ ] You can log in to Ghost ProtoClaw admin as `beardfacebeard@gmail.com`
- [ ] `DATABASE_URL` is set on Railway (needed for `database_query`)
- [ ] `ENCRYPTION_KEY` (or `INTEGRATION_ENCRYPTION_KEY`) is set on Railway (needed to decrypt integration secrets)
- [ ] `SESSION_SECRET` is set on Railway

---

## Phase 1 — Create the business from the template

1. Open `https://<your-railway-host>/admin/businesses/create`
2. Step 1 (Choose Template): pick **TipTax Affiliate Engine** (🦅 icon). It only appears for your session email.
3. Step 2 (Business Details): name it whatever (e.g., "TipTax"). Fill in business details.
4. Step 3 (AI Configuration): accept defaults.
5. Step 4 (Review & Create): confirm **13 agents / ~15 workflows / ~32 knowledge sections**, click Create.

After materialization, note the business ID from the URL (`/admin/businesses/<id>`). You'll need it for webhook URLs.

### Affiliate link config

The TipTax affiliate link (`https://tiptaxrefund.org/9fpc`) is the default baked into the template. Every KB entry + agent prompt uses the `{{affiliateLink}}` placeholder, which is substituted at materialization time from `Business.config.affiliateLink`.

**To override for a specific business at creation time:**
Pass `affiliateLink` in the POST body to `/api/admin/businesses`:
```json
{ "name": "...", "templateId": "tiptax_affiliate_engine", "affiliateLink": "https://tiptaxrefund.org/your-code" }
```

**To change it after the business is already created:**
- Edit the business's config JSON and update `affiliateLink`, OR
- Re-generate the KB entries. The current materialized entries already resolved the placeholder once — changing config alone won't retroactively rewrite them.

Practical recommendation: unless you're switching to a different affiliate program, leave the default `https://tiptaxrefund.org/9fpc` in place.

---

## Phase 2 — Required integrations

These must be configured or the core workflows fail.

### 2a. PostgreSQL (`postgres_mcp`)

Already configured via Railway's `DATABASE_URL` env var. No action needed unless the agent reports `database_query` errors.

### 2b. Instantly — cold email

**Get credentials:**
1. Sign up at [app.instantly.ai](https://app.instantly.ai) — Hypergrowth plan ($97/mo) or higher for API access
2. Connect 5-10 sending inboxes (separate domain recommended for cold outreach) and let them warm up 10-14 days before using
3. Settings → Integrations → **Copy API Key**

**Install in Ghost ProtoClaw:**
1. `/admin/integrations/mcp` → search "Instantly" → Install
2. Paste API key into encrypted secret `api_key`
3. Optional: set `workspace_id` in config if you have multiple workspaces

**Configure webhook for reply ingestion:**
1. Instantly → Settings → Webhooks → Add Webhook
2. URL: `https://<your-railway-host>/api/webhooks/instantly/<businessId>`
3. Subscribe to events: `email.reply`, `lead.replied`, `lead.unsubscribed`, `lead.bounced`
4. Copy the generated webhook secret
5. Back in Ghost ProtoClaw → Instantly Integration → add encrypted secret `webhook_secret` with that value

### 2c. Sendpilot — LinkedIn

You already have **AppSumo Lifetime Tier 2** ([account: aiflowlytics@gmail.com](https://sendpilot.ai)): 3 senders, 3,000 leads/mo, 3,000 extractions/mo. API access is included.

**Get credentials:**
1. Log in to Sendpilot
2. Settings → API → **Create API Key** (name it "Ghost ProtoClaw") → copy the key
3. Connect at least one LinkedIn account in Senders tab. Let it finish warming (status changes from `warming` to `active`) before the agent sends.

**Create the "Connect Only" campaign** (one-time, required for `sendpilot_send_connection_request`):
1. Campaigns → Create Campaign → name it "TipTax Connect Only"
2. Step 1: Connection Request. Use the `{{note}}` merge field for the personal note.
3. Remove any auto-sequence steps (leave just the Connection Request).
4. Copy the campaign ID from the URL (format: `cmp_xxxxxxxxxxxx`)

**Install in Ghost ProtoClaw:**
1. `/admin/integrations/mcp` → search "Sendpilot" → Install
2. Paste API key into encrypted secret `api_key`
3. Set `connect_campaign_id` in config to the campaign ID from above

**Configure webhook:**
1. Sendpilot → Settings → Webhooks → Add Webhook
2. URL: `https://<your-railway-host>/api/webhooks/sendpilot/<businessId>`
3. Events: `message.received`, `message.sent`, `connection.sent`, `connection.accepted`, `lead.status.changed`
4. **Copy the webhook secret — it's shown once.** If you miss it, regenerate.
5. Ghost ProtoClaw → Sendpilot Integration → encrypted secret `webhook_secret`

### 2d. Social Media Hub (Late or Ayrshare)

Aggregator abstracts X, LinkedIn, TikTok, Facebook, Instagram, Pinterest, YouTube, Threads.

**Pick a provider:**
- **Late** ([getlate.dev](https://getlate.dev)): $33/mo Accelerate plan. Recommended for cost.
- **Ayrshare** ([app.ayrshare.com](https://app.ayrshare.com)): $149/mo. More enterprise features.

**Get credentials:**
1. Sign up, connect 8 platforms (TipTax brand accounts on each — don't use personal)
2. Copy API key from dashboard

**Install in Ghost ProtoClaw:**
1. Set Railway env vars:
   - `SOCIAL_PROVIDER=late` (or `ayrshare`)
   - `SOCIAL_API_KEY=<your-key>`
2. `/admin/integrations/mcp` → Social Media Hub → Install

### 2e. Firecrawl — web scraping

For sourcing restaurants from Google Places, Yelp, state license rolls.

**Get credentials:**
1. [firecrawl.dev](https://firecrawl.dev) → sign up
2. Free tier: 500 credits/mo. Hobby $20/mo: 3k credits. Starter $75/mo: 20k. Growth $200/mo: 100k.
3. Copy API key from dashboard

**Install:**
1. `/admin/integrations/mcp` → Firecrawl → Install
2. Paste API key as encrypted `api_key`

---

## Phase 3 — Suggested integrations

Closes additional channel gaps. Install as you need them.

### 3a. ManyChat — FB Messenger + Instagram DMs

Inbound-only — Meta policy blocks cold DMs via any tool. Required for comment-to-DM growth on your own TipTax FB Page + IG Business account.

**Prerequisites:**
- TipTax Facebook Page created
- TipTax Instagram Business/Creator account connected to the FB Page
- Some content posted so ManyChat has something to wire growth tools to

**Get credentials:**
1. [manychat.com](https://manychat.com) → sign up, connect FB Page + IG
2. Pro plan (~$15/mo at 500 contacts, scales) or possibly Business ($200/mo post-March 2026 repricing) required for API
3. Settings → API → generate token (Bearer)

**Install in Ghost ProtoClaw:**
1. `/admin/integrations/mcp` → ManyChat → Install
2. Paste Bearer token as encrypted `api_key`
3. Pick a random 32+ character webhook secret → paste as encrypted `webhook_secret`

**Configure webhook:**
1. ManyChat → Dev Tools → External Requests → add requests for:
   - "New Message" event
   - "Subscribed" event
   - "Tag Added" event
2. Each request URL: `https://<your-railway-host>/api/webhooks/manychat/<businessId>?secret=<same-value-as-webhook_secret-above>`

**Build at least one growth tool:**
- Comment-to-DM keyword trigger on a TipTax post
- Recommended starter: "Comment 'TIPS' on this post and I'll DM you the free eligibility check" — then wire the keyword trigger to send the outcome infographic + tiptaxrefund.org/9fpc link

### 3b. WhatsApp Cloud API (Meta)

For owners who want to continue conversations on WhatsApp.

**Prerequisites:**
- Meta Business account
- Verified business (required to send outside sandbox)

**Get credentials:**
1. [developers.facebook.com](https://developers.facebook.com) → create app → add **WhatsApp** product
2. Generate System User Access Token (long-lived)
3. Note your **WABA ID** and **Phone Number ID** from the WhatsApp → API Setup page
4. App Dashboard → Settings → Basic → **App Secret** (reveal)

**Install in Ghost ProtoClaw:**
1. `/admin/integrations/mcp` → WhatsApp Cloud → Install
2. Encrypted secrets: `system_user_access_token` (long-lived token), `app_secret` (for webhook HMAC)
3. Config (plaintext): `waba_id`, `phone_number_id`, `verify_token` (you pick any random string)

**Configure webhook:**
1. Meta App Dashboard → WhatsApp → Configuration → Webhook
2. Callback URL: `https://<your-railway-host>/api/webhooks/whatsapp/<businessId>`
3. Verify Token: same value you put in config `verify_token` above
4. Click Verify — Meta will GET the URL with `hub.challenge`; we echo it back
5. Subscribe to: `messages`, `message_template_status_update`

**Submit at least one Utility Template:**
- For cold outreach (outside 24h window). Takes 24-72h Meta approval.
- Via agent: `whatsapp_submit_message_template` tool
- Or manually in Meta Business Suite → WhatsApp Manager → Message Templates

### 3c. fal.ai — image + video generation

Required if you want the Content Creator agent to produce custom images for FB / IG / TikTok / Pinterest posts. Skip if you plan to only use the outcome infographic + stock photos (Pexels via Firecrawl/broll_search works independently).

**Get credentials:**
1. [fal.ai](https://fal.ai) → sign up
2. Add a payment method — usage-based pricing:
   - Flux dev: ~$0.003/image (good default)
   - Flux schnell: ~$0.001/image (fastest, lower quality)
   - Flux pro: ~$0.05/image (highest quality, use for hero content only)
   - Video models: $0.10-$0.50 per second of output
3. Dashboard → API Keys → create a new key

**Install in Ghost ProtoClaw:**
- Set Railway env var `FAL_KEY=<your-key>`
- Or install as an MCP with encrypted secret `api_key`. Check `/admin/integrations/mcp` for the exact install flow.

**Budget guard:**
- Content Creator escalates to operator if daily fal.ai spend exceeds $5
- Recommend capping monthly spend at $150 (~50 Flux dev images/day worth)
- Use `broll_search` (Pexels, free) for lifestyle/context shots where custom generation isn't needed

**First-use verification:**
- Chat with Content Creator: "Generate one test Instagram feed image for a restaurant owner tip-credit post"
- Should return a URL from fal.media + dimensions 1080x1080
- If "FAL_KEY not configured" appears → env var missing

### 3d. Reddit — direct posting (`reddit_mcp`)

For community posts/replies that bypass the `log_reddit_target` review queue.

**Get credentials:**
1. Log in to Reddit with the account you want the agent to post from (use an aged account, 1y+ preferred)
2. [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) → scroll to bottom → **create another app...**
3. App type: **script** (important — not web app)
4. Name: "Ghost ProtoClaw TipTax"
5. Redirect URI: `http://localhost` (not used for script type but required)
6. Copy the client ID (small string under the app name) and client secret

**Install in Ghost ProtoClaw:**
1. `/admin/integrations/mcp` → Reddit → Install
2. Encrypted secrets: `client_id`, `client_secret`, `username`, `password` (the Reddit account's actual password)
3. Config: `user_agent` (optional, e.g., `ghost-protoclaw-reddit/1.0 (by u/YOUR_USERNAME)`)

### 3e. Playwright — browser automation

For state license rolls that require JS rendering (some states' ABC/health department sites).

No credentials needed. If the MCP server isn't already installed on Railway, install per platform instructions.

### 3f. HubSpot / GoHighLevel (optional CRM)

For piping signed affiliates into a proper CRM. Not required — `database_query` on the pipeline covers core tracking.

---

## Phase 4 — Post-setup verification

After all required integrations are installed:

### 4a. Dashboard check
1. `/admin/integrations/mcp` — every required integration shows green "connected" status
2. `/admin/businesses/<id>` — business exists
3. `/admin/businesses/<id>/agents` — 13 agents listed (Recovery Ops Lead + 12 specialists, including Content Creator)
4. `/admin/businesses/<id>/knowledge` — ~32 KB entries (look for "Complete Setup Guide", "UTM Parameter Convention", "Prospect Sourcing Sources & URLs", "Platform Image Specs", "TipTax Brand Visual Guidelines", etc.)
5. `/admin/businesses/<id>/workflows` — ~15 workflows

### 4b. Webhook ping test
Manually trigger one event from each vendor dashboard, then check `/admin/businesses/<id>/activity` (Pulse):

- **Instantly:** Settings → Webhooks → Test webhook
- **Sendpilot:** Webhooks settings has a "Send test event" button
- **Meta WhatsApp:** Configuration → Test in dashboard (sends yourself a test message)
- **ManyChat:** Dev Tools → External Requests → Test

Each should produce an ActivityEntry with `status=info` and `metadata.verified=true`. If you see `status=warning`, the webhook secret isn't configured. `status=error` means signature mismatch.

### 4c. Agent smoke test
1. Go to the business chat
2. Ask the Recovery Ops Lead: "Run a test prospect discovery for Austin TX, 50 prospects"
3. Watch for: Hunter calls `scrape_webpage` on Google Places/Yelp, Qualifier scores them, output shows Tier A/B/C split
4. If Hunter fails: check Firecrawl API key
5. If Qualifier produces nothing: check `database_query` dedupe isn't rejecting everything

### 4d. First real batch (low-risk validation)
1. Pick a single metro (Austin TX) + Tier A prospects only (~10 restaurants)
2. Run "Email Cold Outreach Batch (Instantly)" manually — `review_after` mode
3. Review the drafts → confirm UTM params per the UTM Convention KB, confirm 3 pitch registers are varying
4. Approve → watch Instantly send them (check Instantly dashboard for active campaign)
5. Monitor ActivityEntry for the first replies (typically 24-48h)

---

## Phase 5 — Ongoing operator responsibilities

Things that stay manual forever (no compliant API):

- **FB Group posts:** Meta deprecated the Groups Graph API in April 2024. Post manually in restaurant-owner groups with a CTA directing to the TipTax Page so ManyChat catches inbound DMs.
- **Alignable posts:** no public API. Post weekly in local small-business groups.
- **X DMs / FB Messenger DMs / IG DMs to cold prospects:** Meta platform policy blocks all tools. Only warm replies (24h window) are automatable via ManyChat.
- **Multi-unit groups (3+ locations):** Qualifier flags these for you to handle directly via Dave (410-404-2880) rather than automated outreach.

Periodic:
- Rotate Instantly inboxes every 2-3 months (new inboxes = fresh warmup)
- Monitor Sendpilot monthly lead cap (3,000/mo on Tier 2 — ~100/day budget)
- Review Compliance Officer flags daily in the Pipeline Digest

---

## Quick reference — webhook URLs

Replace `<railway-host>` with your actual Railway host, `<businessId>` with the business ID from `/admin/businesses/<id>`:

```
Instantly:  https://<railway-host>/api/webhooks/instantly/<businessId>
Sendpilot:  https://<railway-host>/api/webhooks/sendpilot/<businessId>
WhatsApp:   https://<railway-host>/api/webhooks/whatsapp/<businessId>
ManyChat:   https://<railway-host>/api/webhooks/manychat/<businessId>?secret=<value>
```

---

## Quick reference — vendor credential inventory

| Vendor | Required secrets | Required config |
|---|---|---|
| Instantly | `api_key`, `webhook_secret` | `workspace_id` (optional) |
| Sendpilot | `api_key`, `webhook_secret` | `connect_campaign_id` |
| WhatsApp Cloud | `system_user_access_token`, `app_secret` | `waba_id`, `phone_number_id`, `verify_token` |
| ManyChat | `api_key`, `webhook_secret` | `page_id` (optional) |
| Reddit | `client_id`, `client_secret`, `username`, `password` | `user_agent` (optional) |
| Social Media Hub | `SOCIAL_API_KEY` (env var) | `SOCIAL_PROVIDER` (env var) |
| Firecrawl | `api_key` | — |
| fal.ai (image/video) | `FAL_KEY` env var | — |
| PostgreSQL | `DATABASE_URL` (env var) | — |

---

## Troubleshooting

**"Instantly API key missing" when agent tries to send:**
- Integration not installed in `/admin/integrations/mcp`, or `api_key` not set on the MCP server row

**Webhook events show `status=warning` in ActivityEntry:**
- `webhook_secret` not configured on the Integration → add it

**Webhook events show `status=error`:**
- Signature mismatch. Double-check the secret in the vendor dashboard matches what's in the Integration encrypted secrets. For ManyChat, the `?secret=` URL param must match.

**Sendpilot `sendpilot_send_dm` returns 403:**
- Sender status isn't `active` (still warming). Call `sendpilot_list_senders` and use only active ones.

**WhatsApp webhook never verifies:**
- Meta sent GET with `hub.verify_token` that didn't match. Confirm the `verify_token` config value is exactly what you entered in Meta's dashboard.

**ManyChat `manychat_send_content` returns "outside 24h window":**
- The subscriber hasn't messaged you in the last 24h. Only option: wait for them to DM first, or use a Utility Message Template via `manychat_send_flow` with a flow that uses a template.

**Reddit `reddit_create_post` returns subreddit error:**
- Either subreddit rules rejected (check karma/age requirements), or the account is shadowbanned. Try `verify_reddit_post` to check.
