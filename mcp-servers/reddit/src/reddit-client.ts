import Snoowrap from "snoowrap";

export type RedditConfig = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  userAgent?: string;
};

let _client: Snoowrap | null = null;

export function createRedditClient(config: RedditConfig): Snoowrap {
  if (_client) return _client;

  _client = new Snoowrap({
    userAgent:
      config.userAgent ||
      `GhostProtoClaw/1.0 (by /u/${config.username})`,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    username: config.username,
    password: config.password,
  });

  // Respect Reddit rate limits
  _client.config({
    requestDelay: 1100,
    continueAfterRatelimitError: true,
    retryErrorCodes: [502, 503, 504, 522],
    maxRetryAttempts: 3,
  });

  return _client;
}

export function getClient(): Snoowrap {
  if (!_client) {
    throw new Error(
      "Reddit client not initialized. Call createRedditClient() first."
    );
  }
  return _client;
}

// ── Helpers to serialize Reddit objects for MCP responses ──────────

export function serializePost(post: any) {
  return {
    id: post.id,
    name: post.name,
    title: post.title,
    author: post.author?.name ?? post.author,
    subreddit: post.subreddit?.display_name ?? post.subreddit,
    selftext: post.selftext?.slice(0, 4000) ?? "",
    url: post.url,
    permalink: `https://reddit.com${post.permalink}`,
    score: post.score,
    upvoteRatio: post.upvote_ratio,
    numComments: post.num_comments,
    createdUtc: post.created_utc,
    isNsfw: post.over_18,
    isSelf: post.is_self,
    linkFlair: post.link_flair_text,
    thumbnail: post.thumbnail,
  };
}

export function serializeComment(comment: any) {
  return {
    id: comment.id,
    name: comment.name,
    author: comment.author?.name ?? comment.author,
    body: comment.body?.slice(0, 4000) ?? "",
    score: comment.score,
    permalink: `https://reddit.com${comment.permalink}`,
    createdUtc: comment.created_utc,
    parentId: comment.parent_id,
    isSubmitter: comment.is_submitter,
  };
}

export function serializeSubreddit(sub: any) {
  return {
    name: sub.display_name,
    title: sub.title,
    description: sub.public_description?.slice(0, 2000) ?? "",
    subscribers: sub.subscribers,
    activeUsers: sub.accounts_active,
    createdUtc: sub.created_utc,
    isNsfw: sub.over18,
    url: `https://reddit.com${sub.url}`,
  };
}

export function serializeUser(user: any) {
  return {
    name: user.name,
    commentKarma: user.comment_karma,
    linkKarma: user.link_karma,
    createdUtc: user.created_utc,
    isMod: user.is_mod,
    isGold: user.is_gold,
    iconUrl: user.icon_img,
  };
}
