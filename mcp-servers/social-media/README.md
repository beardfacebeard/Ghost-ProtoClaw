# Social Media Hub MCP Server

Unified social media MCP server — publish, schedule, and analyze posts across TikTok, LinkedIn, Reddit, Twitter/X, Facebook, Instagram, and more through a single integration.

Supports two provider backends:
- **Late** (https://getlate.dev) — Recommended, $33/mo Accelerate plan
- **Ayrshare** (https://ayrshare.com) — Alternative, $149/mo

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOCIAL_PROVIDER` | Yes | `"late"` or `"ayrshare"` |
| `SOCIAL_API_KEY` | Yes | API key from your provider |
| `SOCIAL_PROFILE_KEY` | No | Profile key for multi-profile plans |
| `SOCIAL_PLATFORMS` | No | Comma-separated platform filter |

## Install & Run

```bash
cd mcp-servers/social-media
npm install
npm run build
npm start
```

## Available Tools

- **publish_post** — Publish to multiple platforms at once
- **schedule_post** — Schedule a post for future publishing
- **delete_post** — Delete a published post
- **get_analytics** — Engagement metrics for a post
- **get_post_history** — List recent published posts
- **get_profiles** — List connected social accounts
- **get_comments** — Get comments on a post

## Connecting Platforms

After signing up with Late or Ayrshare, connect your social accounts through their dashboard:
1. Go to your provider dashboard
2. Connect TikTok, LinkedIn, Reddit, etc. via OAuth
3. Copy your API key into Ghost ProtoClaw's MCP install wizard
