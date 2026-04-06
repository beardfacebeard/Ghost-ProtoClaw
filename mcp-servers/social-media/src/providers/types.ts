/**
 * Shared types for social media API providers.
 * Both Late and Ayrshare adapters implement the SocialProvider interface.
 */

export type Platform =
  | "tiktok"
  | "linkedin"
  | "reddit"
  | "twitter"
  | "facebook"
  | "instagram"
  | "youtube"
  | "pinterest"
  | "threads";

export type PostStatus = "published" | "scheduled" | "failed" | "draft";

export type MediaType = "image" | "video" | "carousel";

export type PublishRequest = {
  /** Text body / caption */
  text: string;
  /** Which platforms to publish to */
  platforms: Platform[];
  /** Optional media URLs to attach */
  mediaUrls?: string[];
  /** ISO-8601 datetime to schedule for (omit for immediate) */
  scheduledAt?: string;
  /** Platform-specific overrides */
  platformOptions?: Record<string, Record<string, unknown>>;
};

export type PublishedPost = {
  id: string;
  platform: Platform;
  status: PostStatus;
  postUrl?: string;
  platformPostId?: string;
  scheduledAt?: string;
  publishedAt?: string;
  error?: string;
};

export type PostAnalytics = {
  id: string;
  platform: Platform;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  clicks: number;
  engagementRate: number;
};

export type ProfileInfo = {
  platform: Platform;
  username: string;
  displayName?: string;
  followers?: number;
  connected: boolean;
};

export type PostHistoryItem = {
  id: string;
  platform: Platform;
  text: string;
  status: PostStatus;
  postUrl?: string;
  publishedAt?: string;
  scheduledAt?: string;
};

/**
 * Provider interface — both Late and Ayrshare implement this.
 */
export interface SocialProvider {
  readonly name: string;

  /** Publish or schedule a post to one or more platforms */
  publish(request: PublishRequest): Promise<PublishedPost[]>;

  /** Delete a previously published post */
  deletePost(postId: string): Promise<{ deleted: boolean }>;

  /** Get analytics for a published post */
  getAnalytics(postId: string): Promise<PostAnalytics>;

  /** List recent post history */
  getHistory(options: {
    platform?: Platform;
    limit?: number;
  }): Promise<PostHistoryItem[]>;

  /** Get connected social profiles */
  getProfiles(): Promise<ProfileInfo[]>;

  /** Get comments on a post */
  getComments(
    postId: string
  ): Promise<Array<{ id: string; text: string; author: string; createdAt: string }>>;

  /** Upload media and return a URL usable in publish() */
  uploadMedia?(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ url: string }>;
}
