/**
 * Ayrshare provider adapter.
 *
 * Ayrshare API docs: https://docs.ayrshare.com
 * Base URL: https://app.ayrshare.com/api
 */

import type {
  Platform,
  PostAnalytics,
  PostHistoryItem,
  ProfileInfo,
  PublishedPost,
  PublishRequest,
  SocialProvider,
} from "./types.js";

const BASE_URL = "https://app.ayrshare.com/api";

export class AyrshareProvider implements SocialProvider {
  readonly name = "ayrshare";
  private apiKey: string;
  private profileKey?: string;

  constructor(apiKey: string, profileKey?: string) {
    this.apiKey = apiKey;
    this.profileKey = profileKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.profileKey) {
      headers["Profile-Key"] = this.profileKey;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(
        `Ayrshare API ${method} ${path} failed (${res.status}): ${text}`
      );
    }

    return res.json() as Promise<T>;
  }

  async publish(req: PublishRequest): Promise<PublishedPost[]> {
    const payload: Record<string, unknown> = {
      post: req.text,
      platforms: req.platforms,
    };
    if (req.mediaUrls?.length) {
      payload.mediaUrls = req.mediaUrls;
    }
    if (req.scheduledAt) {
      payload.scheduleDate = req.scheduledAt;
    }
    if (req.platformOptions) {
      // Ayrshare uses per-platform keys at top level
      for (const [platform, opts] of Object.entries(req.platformOptions)) {
        payload[platform] = opts;
      }
    }

    const data = await this.request<any>("POST", "/post", payload);

    // Ayrshare returns postIds per platform
    const posts: PublishedPost[] = req.platforms.map((platform) => {
      const platformData = data.postIds?.find(
        (p: any) => p.platform === platform
      );
      return {
        id: data.id ?? platformData?.id ?? "",
        platform,
        status: data.status === "success" ? "published" : (data.status ?? "published"),
        postUrl: platformData?.postUrl,
        platformPostId: platformData?.id,
        scheduledAt: req.scheduledAt,
        publishedAt: platformData?.publishedAt,
        error: platformData?.error,
      };
    });

    return posts;
  }

  async deletePost(postId: string): Promise<{ deleted: boolean }> {
    await this.request("DELETE", "/post", { id: postId });
    return { deleted: true };
  }

  async getAnalytics(postId: string): Promise<PostAnalytics> {
    const data = await this.request<any>("POST", "/analytics/post", {
      id: postId,
    });
    return {
      id: postId,
      platform: data.platform ?? "unknown",
      likes: data.likes ?? data.analytics?.likes ?? 0,
      comments: data.comments ?? data.analytics?.comments ?? 0,
      shares: data.shares ?? data.analytics?.shares ?? 0,
      impressions: data.impressions ?? data.analytics?.impressions ?? 0,
      reach: data.reach ?? data.analytics?.reach ?? 0,
      clicks: data.clicks ?? data.analytics?.clicks ?? 0,
      engagementRate: data.engagementRate ?? 0,
    };
  }

  async getHistory(options: {
    platform?: Platform;
    limit?: number;
  }): Promise<PostHistoryItem[]> {
    const params: Record<string, unknown> = {};
    if (options.limit) params.lastDays = 30; // Ayrshare uses date ranges

    const data = await this.request<any>("GET", "/history");

    let posts: any[] = data ?? [];
    if (options.platform) {
      posts = posts.filter((p: any) =>
        p.platforms?.includes(options.platform)
      );
    }
    if (options.limit) {
      posts = posts.slice(0, options.limit);
    }

    return posts.map((p: any) => ({
      id: p.id,
      platform: p.platforms?.[0] ?? "unknown",
      text: p.post ?? "",
      status: p.status ?? "published",
      postUrl: p.postUrl,
      publishedAt: p.created,
      scheduledAt: p.scheduleDate,
    }));
  }

  async getProfiles(): Promise<ProfileInfo[]> {
    const data = await this.request<any>("GET", "/profiles");
    const profiles: ProfileInfo[] = [];

    if (data.activeSocialAccounts) {
      for (const platform of data.activeSocialAccounts) {
        profiles.push({
          platform,
          username: data[platform]?.username ?? "",
          displayName: data[platform]?.displayName,
          followers: data[platform]?.followers,
          connected: true,
        });
      }
    }

    return profiles;
  }

  async getComments(postId: string) {
    const data = await this.request<any>("GET", `/comments/${postId}`);
    return (data.comments ?? data ?? []).map((c: any) => ({
      id: c.id ?? "",
      text: c.comment ?? c.text ?? "",
      author: c.commenter ?? c.author ?? "",
      createdAt: c.created ?? "",
    }));
  }

  async uploadMedia(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ url: string }> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append("file", blob, filename);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.profileKey) {
      headers["Profile-Key"] = this.profileKey;
    }

    const res = await fetch(`${BASE_URL}/media/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Ayrshare media upload failed (${res.status})`);
    }

    const data = (await res.json()) as any;
    return { url: data.url };
  }
}
