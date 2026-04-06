# Reddit MCP Server

MCP server for Reddit — read, search, post, comment, and vote via the Reddit API.

## Setup

1. **Create a Reddit app**: Go to https://www.reddit.com/prefs/apps and create a **script** type application.
2. **Note your credentials**: `client_id` (under the app name) and `client_secret`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REDDIT_CLIENT_ID` | Yes | Reddit app client ID |
| `REDDIT_CLIENT_SECRET` | Yes | Reddit app secret |
| `REDDIT_USERNAME` | Yes | Reddit account username |
| `REDDIT_PASSWORD` | Yes | Reddit account password |
| `REDDIT_USER_AGENT` | No | Custom user-agent string |

## Install & Run

```bash
cd mcp-servers/reddit
npm install
npm run build
npm start
```

## Available Tools

### Read
- **search_reddit** — Search posts by query, subreddit, sort, and time
- **get_post** — Get a single post by ID
- **get_post_comments** — Get comments on a post
- **get_subreddit_posts** — Browse subreddit posts (hot/new/top/rising)
- **get_subreddit_info** — Subreddit metadata and stats
- **get_user_info** — Public user profile
- **get_user_posts** — Recent posts by a user

### Write
- **create_post** — Create text or link posts
- **reply_to_post** — Comment on posts or reply to comments
- **edit_post** — Edit your own posts or comments
- **delete_post** — Delete your own posts or comments
- **vote** — Upvote, downvote, or clear votes
