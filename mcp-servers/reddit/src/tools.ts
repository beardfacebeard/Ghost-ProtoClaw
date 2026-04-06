import { z } from "zod";
import {
  getClient,
  serializeComment,
  serializePost,
  serializeSubreddit,
  serializeUser,
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
        .describe("Number of results (max 25)"),
    }),
    handler: async (args: {
      query: string;
      subreddit?: string;
      sort: string;
      time: string;
      limit: number;
    }) => {
      const client = getClient();
      const options: any = {
        query: args.query,
        sort: args.sort,
        time: args.time,
        limit: args.limit,
      };
      if (args.subreddit) {
        options.subreddit = args.subreddit;
      }
      const results = await client.search(options);
      return results.map(serializePost);
    },
  },

  get_post: {
    description:
      "Get a single Reddit post by its ID (e.g. 't3_abc123' or just 'abc123').",
    schema: z.object({
      postId: z.string().describe("Reddit post ID (with or without t3_ prefix)"),
    }),
    handler: async (args: { postId: string }) => {
      const client = getClient();
      const id = args.postId.startsWith("t3_")
        ? args.postId.slice(3)
        : args.postId;
      const submission = await client.getSubmission(id).fetch();
      return serializePost(submission);
    },
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
        .describe("Comment sort order"),
    }),
    handler: async (args: { postId: string; limit: number; sort: string }) => {
      const client = getClient();
      const id = args.postId.startsWith("t3_")
        ? args.postId.slice(3)
        : args.postId;
      const submission = client.getSubmission(id);
      const comments = await submission.comments.fetchMore({
        amount: args.limit,
        sort: args.sort as any,
      });
      return comments
        .filter((c: any) => c.body) // skip "more" stubs
        .map(serializeComment);
    },
  },

  get_subreddit_posts: {
    description:
      "Get the latest or top posts from a subreddit with configurable sort.",
    schema: z.object({
      subreddit: z
        .string()
        .describe("Subreddit name without r/ prefix"),
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
        .describe("Number of posts"),
    }),
    handler: async (args: {
      subreddit: string;
      sort: string;
      time: string;
      limit: number;
    }) => {
      const client = getClient();
      const sub = client.getSubreddit(args.subreddit);
      let listing: any;

      switch (args.sort) {
        case "new":
          listing = await sub.getNew({ limit: args.limit });
          break;
        case "top":
          listing = await sub.getTop({ time: args.time as any, limit: args.limit });
          break;
        case "rising":
          listing = await sub.getRising({ limit: args.limit });
          break;
        case "controversial":
          listing = await sub.getControversial({
            time: args.time as any,
            limit: args.limit,
          });
          break;
        default:
          listing = await sub.getHot({ limit: args.limit });
      }

      return listing.map(serializePost);
    },
  },

  get_subreddit_info: {
    description: "Get information about a subreddit (subscribers, description, rules).",
    schema: z.object({
      subreddit: z.string().describe("Subreddit name without r/ prefix"),
    }),
    handler: async (args: { subreddit: string }) => {
      const client = getClient();
      const sub = await client.getSubreddit(args.subreddit).fetch();
      return serializeSubreddit(sub);
    },
  },

  get_user_info: {
    description: "Get public information about a Reddit user.",
    schema: z.object({
      username: z.string().describe("Reddit username without u/ prefix"),
    }),
    handler: async (args: { username: string }) => {
      const client = getClient();
      const user = await client.getUser(args.username).fetch();
      return serializeUser(user);
    },
  },

  get_user_posts: {
    description: "Get recent posts by a Reddit user.",
    schema: z.object({
      username: z.string().describe("Reddit username"),
      sort: z
        .enum(["new", "hot", "top", "controversial"])
        .default("new"),
      limit: z.number().min(1).max(25).default(10),
    }),
    handler: async (args: { username: string; sort: string; limit: number }) => {
      const client = getClient();
      const user = client.getUser(args.username);
      const posts = await user.getSubmissions({
        sort: args.sort as any,
        limit: args.limit,
      });
      return posts.map(serializePost);
    },
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
      spoiler: z.boolean().default(false).describe("Mark as spoiler"),
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

      const options: any = {
        subredditName: args.subreddit,
        title: args.title,
      };

      if (args.url) {
        options.url = args.url;
      } else {
        options.text = args.text ?? "";
      }

      if (args.flair_id) options.flairId = args.flair_id;
      if (args.flair_text) options.flairText = args.flair_text;

      const submission = await client.submitSelfpost(
        args.url ? { ...options, kind: "link" } : options
      );

      if (args.nsfw) await (submission as any).markNsfw();
      if (args.spoiler) await (submission as any).markSpoiler();

      const fetched = await submission.fetch();
      return serializePost(fetched);
    },
  },

  reply_to_post: {
    description: "Reply to a Reddit post or comment with a text comment.",
    schema: z.object({
      thingId: z
        .string()
        .describe(
          "Full ID of the post (t3_xxx) or comment (t1_xxx) to reply to"
        ),
      body: z.string().min(1).describe("Reply text (markdown)"),
    }),
    handler: async (args: { thingId: string; body: string }) => {
      const client = getClient();
      let parent: any;

      if (args.thingId.startsWith("t1_")) {
        parent = client.getComment(args.thingId.slice(3));
      } else {
        const id = args.thingId.startsWith("t3_")
          ? args.thingId.slice(3)
          : args.thingId;
        parent = client.getSubmission(id);
      }

      const reply = await parent.reply(args.body);
      return serializeComment(reply);
    },
  },

  edit_post: {
    description: "Edit the body text of an existing self-post or comment you own.",
    schema: z.object({
      thingId: z
        .string()
        .describe("Full ID of your post (t3_xxx) or comment (t1_xxx)"),
      body: z.string().min(1).describe("New body text (markdown)"),
    }),
    handler: async (args: { thingId: string; body: string }) => {
      const client = getClient();
      let thing: any;

      if (args.thingId.startsWith("t1_")) {
        thing = client.getComment(args.thingId.slice(3));
      } else {
        const id = args.thingId.startsWith("t3_")
          ? args.thingId.slice(3)
          : args.thingId;
        thing = client.getSubmission(id);
      }

      const edited = await thing.edit(args.body);
      return args.thingId.startsWith("t1_")
        ? serializeComment(edited)
        : serializePost(edited);
    },
  },

  delete_post: {
    description: "Delete a post or comment you own. This is irreversible.",
    schema: z.object({
      thingId: z
        .string()
        .describe("Full ID of the post (t3_xxx) or comment (t1_xxx) to delete"),
    }),
    handler: async (args: { thingId: string }) => {
      const client = getClient();
      let thing: any;

      if (args.thingId.startsWith("t1_")) {
        thing = client.getComment(args.thingId.slice(3));
      } else {
        const id = args.thingId.startsWith("t3_")
          ? args.thingId.slice(3)
          : args.thingId;
        thing = client.getSubmission(id);
      }

      await thing.delete();
      return { deleted: true, id: args.thingId };
    },
  },

  vote: {
    description: "Upvote, downvote, or clear a vote on a post or comment.",
    schema: z.object({
      thingId: z.string().describe("Full ID (t3_xxx or t1_xxx)"),
      direction: z
        .enum(["up", "down", "none"])
        .describe("Vote direction — 'none' clears the vote"),
    }),
    handler: async (args: { thingId: string; direction: string }) => {
      const client = getClient();
      let thing: any;

      if (args.thingId.startsWith("t1_")) {
        thing = client.getComment(args.thingId.slice(3));
      } else {
        const id = args.thingId.startsWith("t3_")
          ? args.thingId.slice(3)
          : args.thingId;
        thing = client.getSubmission(id);
      }

      switch (args.direction) {
        case "up":
          await thing.upvote();
          break;
        case "down":
          await thing.downvote();
          break;
        default:
          await thing.unvote();
      }

      return { voted: args.direction, id: args.thingId };
    },
  },
} as const;
