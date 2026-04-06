import { z } from "zod";
import type { SocialProvider, Platform } from "./providers/index.js";

const PlatformEnum = z.enum([
  "tiktok",
  "linkedin",
  "reddit",
  "twitter",
  "facebook",
  "instagram",
  "youtube",
  "pinterest",
  "threads",
]);

/**
 * Build all social media MCP tools bound to a given provider instance.
 */
export function buildTools(provider: SocialProvider) {
  return {
    publish_post: {
      description:
        "Publish or schedule a post to one or more social media platforms (TikTok, LinkedIn, Reddit, etc.).",
      schema: z.object({
        text: z.string().min(1).describe("Post text / caption"),
        platforms: z
          .array(PlatformEnum)
          .min(1)
          .describe("Platforms to publish to"),
        mediaUrls: z
          .array(z.string().url())
          .optional()
          .describe("Media URLs to attach (images or videos)"),
        scheduledAt: z
          .string()
          .optional()
          .describe(
            "ISO-8601 datetime to schedule for. Omit for immediate publish."
          ),
        platformOptions: z
          .record(z.string(), z.record(z.string(), z.unknown()))
          .optional()
          .describe("Platform-specific overrides (e.g. TikTok privacy settings)"),
      }),
      handler: async (args: {
        text: string;
        platforms: Platform[];
        mediaUrls?: string[];
        scheduledAt?: string;
        platformOptions?: Record<string, Record<string, unknown>>;
      }) => {
        return provider.publish({
          text: args.text,
          platforms: args.platforms,
          mediaUrls: args.mediaUrls,
          scheduledAt: args.scheduledAt,
          platformOptions: args.platformOptions,
        });
      },
    },

    delete_post: {
      description: "Delete a previously published social media post by ID.",
      schema: z.object({
        postId: z.string().describe("Post ID returned by publish_post"),
      }),
      handler: async (args: { postId: string }) => {
        return provider.deletePost(args.postId);
      },
    },

    get_analytics: {
      description:
        "Get engagement analytics (likes, comments, shares, impressions) for a published post.",
      schema: z.object({
        postId: z.string().describe("Post ID"),
      }),
      handler: async (args: { postId: string }) => {
        return provider.getAnalytics(args.postId);
      },
    },

    get_post_history: {
      description: "List recent posts published through the social media hub.",
      schema: z.object({
        platform: PlatformEnum.optional().describe(
          "Filter to a single platform"
        ),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(20)
          .describe("Number of posts to return"),
      }),
      handler: async (args: { platform?: Platform; limit: number }) => {
        return provider.getHistory({
          platform: args.platform,
          limit: args.limit,
        });
      },
    },

    get_profiles: {
      description:
        "List all connected social media profiles and their follower counts.",
      schema: z.object({}),
      handler: async () => {
        return provider.getProfiles();
      },
    },

    get_comments: {
      description: "Get comments on a published social media post.",
      schema: z.object({
        postId: z.string().describe("Post ID"),
      }),
      handler: async (args: { postId: string }) => {
        return provider.getComments(args.postId);
      },
    },

    schedule_post: {
      description:
        "Schedule a post for future publishing. Convenience wrapper around publish_post with a required schedule time.",
      schema: z.object({
        text: z.string().min(1).describe("Post text / caption"),
        platforms: z.array(PlatformEnum).min(1),
        scheduledAt: z
          .string()
          .describe("ISO-8601 datetime to schedule for (required)"),
        mediaUrls: z
          .array(z.string().url())
          .optional()
          .describe("Media URLs to attach"),
      }),
      handler: async (args: {
        text: string;
        platforms: Platform[];
        scheduledAt: string;
        mediaUrls?: string[];
      }) => {
        return provider.publish({
          text: args.text,
          platforms: args.platforms,
          scheduledAt: args.scheduledAt,
          mediaUrls: args.mediaUrls,
        });
      },
    },
  } as const;
}
