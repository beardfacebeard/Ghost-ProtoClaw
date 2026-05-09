/**
 * Direct Reddit API client.
 *
 * Replaces snoowrap (archived 2024-03 by upstream maintainer, last release
 * 2020). This module implements only the surface area the Reddit MCP server
 * actually uses, with proper TypeScript types throughout — no `any` casts.
 *
 * Auth: OAuth2 "script app" password grant against
 * https://www.reddit.com/api/v1/access_token. All authenticated calls go to
 * https://oauth.reddit.com with `Authorization: bearer <token>`.
 *
 * Rate limiting:
 *   - 1100ms minimum interval between requests (matches snoowrap's default,
 *     well under Reddit's 100 req/min OAuth ceiling — gives ~55 req/min
 *     headroom)
 *   - Retries on 502 / 503 / 504 / 522 with exponential backoff (max 3
 *     attempts), and on 401 once (forces a token refresh on the retry)
 *   - Reddit returns `x-ratelimit-remaining` / `x-ratelimit-reset` headers
 *     on every authenticated response. If you start brushing the ceiling
 *     under heavy bursts, extend the throttle to honor those headers —
 *     hooks in `request()` make this a 5-line addition.
 *
 * Tokens last 1h. We refresh proactively when ≤60s remain, and reactively
 * if Reddit returns 401.
 */

// ── Public-shape types (what tools.ts handlers serialize into) ────────

export type RedditPost = {
  id: string;
  name: string;
  title: string;
  author: string;
  subreddit: string;
  selftext: string;
  url: string;
  permalink: string;
  score: number;
  upvoteRatio: number;
  numComments: number;
  createdUtc: number;
  isNsfw: boolean;
  isSelf: boolean;
  linkFlair: string | null;
  thumbnail: string;
};

export type RedditComment = {
  id: string;
  name: string;
  author: string;
  body: string;
  score: number;
  permalink: string;
  createdUtc: number;
  parentId: string;
  isSubmitter: boolean;
};

export type RedditSubreddit = {
  name: string;
  title: string;
  description: string;
  subscribers: number;
  activeUsers: number;
  createdUtc: number;
  isNsfw: boolean;
  url: string;
};

export type RedditUser = {
  name: string;
  commentKarma: number;
  linkKarma: number;
  createdUtc: number;
  isMod: boolean;
  isGold: boolean;
  iconUrl: string;
};

// ── Listing-option types ─────────────────────────────────────────────

export type SearchSort = "relevance" | "hot" | "top" | "new" | "comments";
export type TimeFilter = "hour" | "day" | "week" | "month" | "year" | "all";
export type SubredditSort =
  | "hot"
  | "new"
  | "top"
  | "rising"
  | "controversial";
export type CommentSort =
  | "confidence"
  | "top"
  | "new"
  | "controversial"
  | "old"
  | "qa";
export type UserSort = "new" | "hot" | "top" | "controversial";
export type VoteDirection = "up" | "down" | "none";

export type SearchOptions = {
  query: string;
  subreddit?: string;
  sort?: SearchSort;
  time?: TimeFilter;
  limit?: number;
};

export type GetPostCommentsOptions = {
  postId: string;
  sort?: CommentSort;
  limit?: number;
};

export type GetSubredditPostsOptions = {
  subreddit: string;
  sort?: SubredditSort;
  time?: TimeFilter;
  limit?: number;
};

export type GetUserPostsOptions = {
  username: string;
  sort?: UserSort;
  limit?: number;
};

export type SubmitPostOptions = {
  subreddit: string;
  title: string;
  text?: string;
  url?: string;
  flairId?: string;
  flairText?: string;
  nsfw?: boolean;
  spoiler?: boolean;
};

// ── Reddit API raw shapes (what the JSON endpoints return) ───────────
//
// We only model the fields we read; Reddit returns much more. Marking
// fields optional where Reddit may omit them in some responses.

type RedditRawPost = {
  id: string;
  name: string;
  title: string;
  author: string;
  subreddit: string;
  selftext?: string;
  url: string;
  permalink: string;
  score: number;
  upvote_ratio?: number;
  num_comments: number;
  created_utc: number;
  over_18?: boolean;
  is_self?: boolean;
  link_flair_text?: string | null;
  thumbnail?: string;
};

type RedditRawComment = {
  id: string;
  name: string;
  author: string;
  body?: string;
  score: number;
  permalink?: string;
  created_utc: number;
  parent_id: string;
  is_submitter?: boolean;
};

type RedditRawSubreddit = {
  display_name: string;
  title: string;
  public_description?: string;
  subscribers: number;
  accounts_active?: number;
  created_utc: number;
  over18?: boolean;
  url: string;
};

type RedditRawUser = {
  name: string;
  comment_karma: number;
  link_karma: number;
  created_utc: number;
  is_mod?: boolean;
  is_gold?: boolean;
  icon_img?: string;
};

type RedditListingChild<T> = {
  kind: string;
  data: T;
};

type RedditListing<T> = {
  kind: "Listing";
  data: {
    after: string | null;
    before: string | null;
    children: RedditListingChild<T>[];
    dist?: number;
  };
};

type RedditThing<T> = {
  kind: string;
  data: T;
};

type SubmitResponse = {
  json?: {
    errors?: unknown[];
    data?: {
      id?: string;
      name?: string;
      url?: string;
    };
  };
};

type CommentSubmitResponse = {
  json?: {
    errors?: unknown[];
    data?: {
      things?: { kind: string; data: RedditRawComment }[];
    };
  };
};

type AccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

// ── Errors ───────────────────────────────────────────────────────────

export class RedditApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string,
    message: string
  ) {
    super(`[${status}] ${endpoint}: ${message}`);
    this.name = "RedditApiError";
  }
}

// ── Config ───────────────────────────────────────────────────────────

export type RedditConfig = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  userAgent?: string;
};

const DEFAULT_MIN_DELAY_MS = 1100;
const TOKEN_REFRESH_BUFFER_S = 60;
const RETRY_STATUSES = new Set([502, 503, 504, 522]);
const MAX_RETRIES = 3;

// ── Serializers (raw API shape → public shape) ───────────────────────

function serializePost(raw: RedditRawPost): RedditPost {
  return {
    id: raw.id,
    name: raw.name,
    title: raw.title,
    author: raw.author,
    subreddit: raw.subreddit,
    selftext: (raw.selftext ?? "").slice(0, 4000),
    url: raw.url,
    permalink: `https://reddit.com${raw.permalink}`,
    score: raw.score,
    upvoteRatio: raw.upvote_ratio ?? 0,
    numComments: raw.num_comments,
    createdUtc: raw.created_utc,
    isNsfw: raw.over_18 ?? false,
    isSelf: raw.is_self ?? false,
    linkFlair: raw.link_flair_text ?? null,
    thumbnail: raw.thumbnail ?? ""
  };
}

function serializeComment(raw: RedditRawComment): RedditComment {
  return {
    id: raw.id,
    name: raw.name,
    author: raw.author,
    body: (raw.body ?? "").slice(0, 4000),
    score: raw.score,
    permalink: raw.permalink ? `https://reddit.com${raw.permalink}` : "",
    createdUtc: raw.created_utc,
    parentId: raw.parent_id,
    isSubmitter: raw.is_submitter ?? false
  };
}

function serializeSubreddit(raw: RedditRawSubreddit): RedditSubreddit {
  return {
    name: raw.display_name,
    title: raw.title,
    description: (raw.public_description ?? "").slice(0, 2000),
    subscribers: raw.subscribers,
    activeUsers: raw.accounts_active ?? 0,
    createdUtc: raw.created_utc,
    isNsfw: raw.over18 ?? false,
    url: `https://reddit.com${raw.url}`
  };
}

function serializeUser(raw: RedditRawUser): RedditUser {
  return {
    name: raw.name,
    commentKarma: raw.comment_karma,
    linkKarma: raw.link_karma,
    createdUtc: raw.created_utc,
    isMod: raw.is_mod ?? false,
    isGold: raw.is_gold ?? false,
    iconUrl: raw.icon_img ?? ""
  };
}

// Strip the `t3_` / `t1_` prefix when callers pass full thing-IDs but the
// endpoint wants the bare id portion.
function stripPrefix(id: string, prefix: string): string {
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

// ── The client ───────────────────────────────────────────────────────

export class RedditClient {
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private lastRequestAt = 0;
  private readonly userAgent: string;

  constructor(private readonly config: RedditConfig) {
    this.userAgent =
      config.userAgent ||
      `node:ghost-protoclaw-reddit:1.0.0 (by /u/${config.username})`;
  }

  // ── Auth ────────────────────────────────────────────────────────

  /** Ensure we have a non-expired bearer token; refresh if needed. */
  async ensureToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (
      this.accessToken &&
      this.tokenExpiresAt - TOKEN_REFRESH_BUFFER_S > now
    ) {
      return this.accessToken;
    }

    const auth = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString("base64");

    const body = new URLSearchParams({
      grant_type: "password",
      username: this.config.username,
      password: this.config.password
    });

    const response = await fetch(
      "https://www.reddit.com/api/v1/access_token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": this.userAgent
        },
        body
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new RedditApiError(
        response.status,
        "/api/v1/access_token",
        `Token request failed: ${text.slice(0, 200)}`
      );
    }

    const data = (await response.json()) as AccessTokenResponse;
    if (!data.access_token) {
      throw new RedditApiError(
        500,
        "/api/v1/access_token",
        "Token response missing access_token"
      );
    }

    this.accessToken = data.access_token;
    this.tokenExpiresAt = now + data.expires_in;
    return this.accessToken;
  }

  // ── Throttle + request core ────────────────────────────────────

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < DEFAULT_MIN_DELAY_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, DEFAULT_MIN_DELAY_MS - elapsed)
      );
    }
    this.lastRequestAt = Date.now();
  }

  /**
   * Fire an authenticated request to oauth.reddit.com. Handles token
   * refresh, throttling, exponential-backoff retries on 5xx, and JSON
   * parsing. Returns the parsed response body.
   */
  private async request<T>(
    method: "GET" | "POST",
    path: string,
    options: {
      query?: Record<string, string | number | undefined>;
      formBody?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<T> {
    let url = `https://oauth.reddit.com${path}`;
    if (options.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null) continue;
        params.set(key, String(value));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    let body: BodyInit | undefined;
    if (options.formBody) {
      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(options.formBody)) {
        if (value === undefined || value === null) continue;
        formData.set(key, String(value));
      }
      body = formData;
    }

    let attempt = 0;
    while (true) {
      attempt++;
      await this.throttle();
      const token = await this.ensureToken();

      const headers: Record<string, string> = {
        Authorization: `bearer ${token}`,
        "User-Agent": this.userAgent
      };
      if (body) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      }

      const response = await fetch(url, { method, headers, body });

      // Reactive token refresh on 401 — Reddit invalidated our token.
      if (response.status === 401 && attempt === 1) {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        continue;
      }

      // Retryable 5xx — exponential backoff.
      if (RETRY_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
        const backoffMs = 1000 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new RedditApiError(
          response.status,
          path,
          text.slice(0, 200) || response.statusText
        );
      }

      // Some endpoints (e.g. delete) return empty bodies on success.
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        return undefined as unknown as T;
      }
      return (await response.json()) as T;
    }
  }

  // ── Listings (read) ────────────────────────────────────────────

  async search(opts: SearchOptions): Promise<RedditPost[]> {
    const path = opts.subreddit
      ? `/r/${opts.subreddit}/search`
      : `/search`;
    const data = await this.request<RedditListing<RedditRawPost>>("GET", path, {
      query: {
        q: opts.query,
        sort: opts.sort ?? "relevance",
        t: opts.time ?? "all",
        limit: opts.limit ?? 10,
        restrict_sr: opts.subreddit ? "1" : undefined,
        type: "link"
      }
    });
    return data.data.children.map((child) => serializePost(child.data));
  }

  async getPost(postId: string): Promise<RedditPost> {
    const id = stripPrefix(postId, "t3_");
    // /by_id/t3_<id> returns a Listing with one post; cleaner than parsing
    // the comments-tree response when we just want the post.
    const data = await this.request<RedditListing<RedditRawPost>>(
      "GET",
      `/by_id/t3_${id}`
    );
    const child = data.data.children[0];
    if (!child) {
      throw new RedditApiError(404, `/by_id/t3_${id}`, "Post not found");
    }
    return serializePost(child.data);
  }

  async getPostComments(opts: GetPostCommentsOptions): Promise<RedditComment[]> {
    const id = stripPrefix(opts.postId, "t3_");
    // /comments/<id> returns [postListing, commentListing]
    const data = await this.request<
      [RedditListing<RedditRawPost>, RedditListing<RedditRawComment>]
    >("GET", `/comments/${id}`, {
      query: {
        sort: opts.sort ?? "top",
        limit: opts.limit ?? 20
      }
    });

    const commentListing = data[1];
    if (!commentListing) return [];

    return commentListing.data.children
      .filter((child) => child.kind === "t1" && child.data.body)
      .map((child) => serializeComment(child.data));
  }

  async getSubredditInfo(subreddit: string): Promise<RedditSubreddit> {
    const data = await this.request<RedditThing<RedditRawSubreddit>>(
      "GET",
      `/r/${subreddit}/about`
    );
    return serializeSubreddit(data.data);
  }

  async getSubredditPosts(
    opts: GetSubredditPostsOptions
  ): Promise<RedditPost[]> {
    const sort = opts.sort ?? "hot";
    const path = `/r/${opts.subreddit}/${sort}`;
    const data = await this.request<RedditListing<RedditRawPost>>(
      "GET",
      path,
      {
        query: {
          limit: opts.limit ?? 10,
          // Reddit accepts `t` only on top + controversial; passing it on
          // hot/new/rising is ignored without error so we always send it.
          t: opts.time ?? "day"
        }
      }
    );
    return data.data.children.map((child) => serializePost(child.data));
  }

  async getUserInfo(username: string): Promise<RedditUser> {
    const data = await this.request<RedditThing<RedditRawUser>>(
      "GET",
      `/user/${username}/about`
    );
    return serializeUser(data.data);
  }

  async getUserPosts(opts: GetUserPostsOptions): Promise<RedditPost[]> {
    const data = await this.request<RedditListing<RedditRawPost>>(
      "GET",
      `/user/${opts.username}/submitted`,
      {
        query: {
          sort: opts.sort ?? "new",
          limit: opts.limit ?? 10
        }
      }
    );
    return data.data.children.map((child) => serializePost(child.data));
  }

  // ── Mutations (write) ──────────────────────────────────────────

  /**
   * Submit a new self-post or link-post. Returns the freshly-fetched post
   * so the caller can serialize it. Honors nsfw + spoiler flags by firing
   * `/api/marknsfw` and `/api/spoiler` after submission.
   */
  async submitPost(opts: SubmitPostOptions): Promise<RedditPost> {
    const formBody: Record<string, string | boolean | undefined> = {
      sr: opts.subreddit,
      title: opts.title,
      api_type: "json",
      kind: opts.url ? "link" : "self"
    };
    if (opts.url) {
      formBody.url = opts.url;
    } else {
      formBody.text = opts.text ?? "";
    }
    if (opts.flairId) formBody.flair_id = opts.flairId;
    if (opts.flairText) formBody.flair_text = opts.flairText;

    const response = await this.request<SubmitResponse>(
      "POST",
      "/api/submit",
      { formBody }
    );

    const errors = response.json?.errors;
    if (errors && errors.length > 0) {
      throw new RedditApiError(
        400,
        "/api/submit",
        `Submission rejected: ${JSON.stringify(errors)}`
      );
    }

    const fullName = response.json?.data?.name;
    if (!fullName) {
      throw new RedditApiError(
        500,
        "/api/submit",
        "Submission response missing post name"
      );
    }

    if (opts.nsfw) await this.markNsfw(fullName);
    if (opts.spoiler) await this.markSpoiler(fullName);

    // Re-fetch to get the canonical state (and to honor the original tool
    // contract which returned the fully-populated post).
    return this.getPost(fullName);
  }

  /**
   * Reply to a post (t3_) or comment (t1_). Returns the new comment.
   */
  async reply(thingId: string, body: string): Promise<RedditComment> {
    const response = await this.request<CommentSubmitResponse>(
      "POST",
      "/api/comment",
      {
        formBody: {
          api_type: "json",
          thing_id: thingId,
          text: body
        }
      }
    );

    const errors = response.json?.errors;
    if (errors && errors.length > 0) {
      throw new RedditApiError(
        400,
        "/api/comment",
        `Reply rejected: ${JSON.stringify(errors)}`
      );
    }

    const thing = response.json?.data?.things?.[0];
    if (!thing || thing.kind !== "t1") {
      throw new RedditApiError(
        500,
        "/api/comment",
        "Reply response missing comment"
      );
    }
    return serializeComment(thing.data);
  }

  /**
   * Edit the body of a self-post or comment owned by the auth account.
   * Returns the updated thing as either a Post or Comment, depending on
   * the `t3_` / `t1_` prefix of `thingId`.
   */
  async edit(
    thingId: string,
    body: string
  ): Promise<RedditPost | RedditComment> {
    await this.request<unknown>("POST", "/api/editusertext", {
      formBody: {
        api_type: "json",
        thing_id: thingId,
        text: body
      }
    });

    if (thingId.startsWith("t1_")) {
      // Refetch the comment via /api/info so we return canonical state.
      const data = await this.request<RedditListing<RedditRawComment>>(
        "GET",
        "/api/info",
        { query: { id: thingId } }
      );
      const child = data.data.children[0];
      if (!child) {
        throw new RedditApiError(404, "/api/info", "Comment not found");
      }
      return serializeComment(child.data);
    }
    return this.getPost(thingId);
  }

  /** Delete a post or comment owned by the auth account. */
  async delete(thingId: string): Promise<void> {
    await this.request<unknown>("POST", "/api/del", {
      formBody: { id: thingId }
    });
  }

  /** Vote on a post or comment. `direction` "none" clears any prior vote. */
  async vote(thingId: string, direction: VoteDirection): Promise<void> {
    const dir = direction === "up" ? 1 : direction === "down" ? -1 : 0;
    await this.request<unknown>("POST", "/api/vote", {
      formBody: { id: thingId, dir }
    });
  }

  /** Mark a post NSFW. */
  async markNsfw(postFullName: string): Promise<void> {
    await this.request<unknown>("POST", "/api/marknsfw", {
      formBody: { id: postFullName }
    });
  }

  /** Mark a post as a spoiler. */
  async markSpoiler(postFullName: string): Promise<void> {
    await this.request<unknown>("POST", "/api/spoiler", {
      formBody: { id: postFullName }
    });
  }
}

// ── Process-wide singleton (kept for backward compat with tools.ts) ──

let _client: RedditClient | null = null;

export function createRedditClient(config: RedditConfig): RedditClient {
  if (_client) return _client;
  _client = new RedditClient(config);
  return _client;
}

export function getClient(): RedditClient {
  if (!_client) {
    throw new Error(
      "Reddit client not initialized. Call createRedditClient() first."
    );
  }
  return _client;
}
