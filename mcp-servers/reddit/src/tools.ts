import { z } from "zod";

import {
  getClient,
  type CommentSort,
  type SearchSort,
  type SubredditSort,
  type TimeFilter,
  type UserSort,
  type VoteDirection
} from "./reddit-client.js";

// ── Tool definitions ──────────────────────────────────────────────

export const REDDIT_TOOLS = {
  // ── Read ─────────────────────────────────────────────────────────

  search_reddit: {
    description:
      "Search Reddit for posts matching a query. Supports subreddit scoping and sort options.",
    schema: z.object({
      query: z.string().describe("Search query"),
      subreddit: z
        .string()
        .optional()
        .describe("Limit search to this subreddit (without r/ prefix)"),
      sort: z
        .enum(["relevance", "hot", "top", "new", "comments"])
        .default("relevance")
        .describe("Sort order"),
      time: z
        .enum(["hour", "day", "week", "month", "year", "all"])
        .default("all")
        .describe("Time filter"),
      limit: z
        .number()
        .min(1)
        .max(25)
        .default(10)
        .describe("Number of results (max 25)")
    }),
    handler: async (args: {
      query: string;
      subreddit?: string;
      sort: SearchSort;
      time: TimeFilter;
      limit: number;
    }) => {
      const client = getClient();
      return client.search({
        query: args.query,
        subreddit: args.subreddit,
        sort: args.sort,
        time: args.time,
        limit: args.limit
      });
    }
  },

  get_post: {
    description:
      "Get a single Reddit post by its ID (e.g. 't3_abc123' or just 'abc123').",
    schema: z.object({
      postId: z.string().describe("Reddit post ID (with or without t3_ prefix)")
    }),
    handler: async (args: { postId: string }) => {
      const client = getClient();
      return client.getPost(args.postId);
    }
  },

  get_post_comments: {
    description: "Get top-level comments for a Reddit post.",
    schema: z.object({
      postId: z.string().describe("Reddit post ID"),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(20)
        .describe("Number of comments"),
      sort: z
        .enum(["confidence", "top", "new", "controversial", "old", "qa"])
        .default("top")
        .describe("Comment sort order")
    }),
    handler: async (args: {
      postId: string;
      limit: number;
      sort: CommentSort;
    }) => {
      const client = getClient();
      return client.getPostComments({
        postId: args.postId,
        sort: args.sort,
        limit: args.limit
      });
    }
  },

  get_subreddit_posts: {
    description:
      "Get the latest or top posts from a subreddit with configurable sort.",
    schema: z.object({
      subreddit: z.string().describe("Subreddit name without r/ prefix"),
      sort: z
        .enum(["hot", "new", "top", "rising", "controversial"])
        .default("hot")
        .describe("Sort order"),
      time: z
        .enum(["hour", "day", "week", "month", "year", "all"])
        .default("day")
        .describe("Time filter (for top / controversial)"),
      limit: z
        .number()
        .min(1)
        .max(25)
        .default(10)
        .describe("Number of posts")
    }),
    handler: async (args: {
      subreddit: string;
      sort: SubredditSort;
      time: TimeFilter;
      limit: number;
    }) => {
      const client = getClient();
      return client.getSubredditPosts({
        subreddit: args.subreddit,
        sort: args.sort,
        time: args.time,
        limit: args.limit
      });
    }
  },

  get_subreddit_info: {
    description:
      "Get information about a subreddit (subscribers, description, rules).",
    schema: z.object({
      subreddit: z.string().describe("Subreddit name without r/ prefix")
    }),
    handler: async (args: { subreddit: string }) => {
      const client = getClient();
      return client.getSubredditInfo(args.subreddit);
    }
  },

  get_user_info: {
    description: "Get public information about a Reddit user.",
    schema: z.object({
      username: z.string().describe("Reddit username without u/ prefix")
    }),
    handler: async (args: { username: string }) => {
      const client = getClient();
      return client.getUserInfo(args.username);
    }
  },

  get_user_posts: {
    description: "Get recent posts by a Reddit user.",
    schema: z.object({
      username: z.string().describe("Reddit username"),
      sort: z
        .enum(["new", "hot", "top", "controversial"])
        .default("new"),
      limit: z.number().min(1).max(25).default(10)
    }),
    handler: async (args: {
      username: string;
      sort: UserSort;
      limit: number;
    }) => {
      const client = getClient();
      return client.getUserPosts({
        username: args.username,
        sort: args.sort,
        limit: args.limit
      });
    }
  },

  // ── Write ────────────────────────────────────────────────────────

  create_post: {
    description:
      "Create a new text or link post in a subreddit. Returns the created post.",
    schema: z.object({
      subreddit: z.string().describe("Subreddit name without r/ prefix"),
      title: z.string().min(1).max(300).describe("Post title"),
      text: z
        .string()
        .optional()
        .describe("Post body text (markdown). Omit for link posts."),
      url: z
        .string()
        .url()
        .optional()
        .describe("URL for link posts. Omit for self/text posts."),
      flair_id: z.string().optional().describe("Flair template ID if required"),
      flair_text: z.string().optional().describe("Flair text"),
      nsfw: z.boolean().default(false).describe("Mark as NSFW"),
      spoiler: z.boolean().default(false).describe("Mark as spoiler")
    }),
    handler: async (args: {
      subreddit: string;
      title: string;
      text?: string;
      url?: string;
      flair_id?: string;
      flair_text?: string;
      nsfw: boolean;
      spoiler: boolean;
    }) => {
      const client = getClient();
      return client.submitPost({
        subreddit: args.subreddit,
        title: args.title,
        text: args.text,
        url: args.url,
        flairId: args.flair_id,
        flairText: args.flair_text,
        nsfw: args.nsfw,
        spoiler: args.spoiler
      });
    }
  },

  reply_to_post: {
    description: "Reply to a Reddit post or comment with a text comment.",
    schema: z.object({
      thingId: z
        .string()
        .describe(
          "Full ID of the post (t3_xxx) or comment (t1_xxx) to reply to"
        ),
      body: z.string().min(1).describe("Reply text (markdown)")
    }),
    handler: async (args: { thingId: string; body: string }) => {
      const client = getClient();
      // Reddit's `/api/comment` endpoint accepts either t3_ or t1_ thing_id
      // directly — no need to dispatch on prefix the way snoowrap did.
      const fullId = args.thingId.startsWith("t1_") || args.thingId.startsWith("t3_")
        ? args.thingId
        : `t3_${args.thingId}`;
      return client.reply(fullId, args.body);
    }
  },

  edit_post: {
    description:
      "Edit the body text of an existing self-post or comment you own.",
    schema: z.object({
      thingId: z
        .string()
        .describe("Full ID of your post (t3_xxx) or comment (t1_xxx)"),
      body: z.string().min(1).describe("New body text (markdown)")
    }),
    handler: async (args: { thingId: string; body: string }) => {
      const client = getClient();
      const fullId = args.thingId.startsWith("t1_") || args.thingId.startsWith("t3_")
        ? args.thingId
        : `t3_${args.thingId}`;
      return client.edit(fullId, args.body);
    }
  },

  delete_post: {
    description: "Delete a post or comment you own. This is irreversible.",
    schema: z.object({
      thingId: z
        .string()
        .describe("Full ID of the post (t3_xxx) or comment (t1_xxx) to delete")
    }),
    handler: async (args: { thingId: string }) => {
      const client = getClient();
      const fullId = args.thingId.startsWith("t1_") || args.thingId.startsWith("t3_")
        ? args.thingId
        : `t3_${args.thingId}`;
      await client.delete(fullId);
      return { deleted: true, id: args.thingId };
    }
  },

  vote: {
    description: "Upvote, downvote, or clear a vote on a post or comment.",
    schema: z.object({
      thingId: z.string().describe("Full ID (t3_xxx or t1_xxx)"),
      direction: z
        .enum(["up", "down", "none"])
        .describe("Vote direction — 'none' clears the vote")
    }),
    handler: async (args: { thingId: string; direction: VoteDirection }) => {
      const client = getClient();
      const fullId = args.thingId.startsWith("t1_") || args.thingId.startsWith("t3_")
        ? args.thingId
        : `t3_${args.thingId}`;
      await client.vote(fullId, args.direction);
      return { voted: args.direction, id: args.thingId };
    }
  }
} as const;
