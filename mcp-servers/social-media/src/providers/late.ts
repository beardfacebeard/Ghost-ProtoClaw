/**
 * Late (getlate.dev) provider adapter.
 *
 * Late API docs: https://docs.getlate.dev
 * Base URL: https://api.getlate.dev/v1
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

const BASE_URL = "https://api.getlate.dev/v1";

export class LateProvider implements SocialProvider {
  readonly name = "late";
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
      headers["X-Profile-Key"] = this.profileKey;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new Error(`Late API ${method} ${path} failed (${res.status}): ${text}`);
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
      payload.platformOptions = req.platformOptions;
    }

    const data = await this.request<any>("POST", "/post", payload);

    // Normalize Late's response
    const posts: PublishedPost[] = (data.posts ?? [data]).map((p: any) => ({
      id: p.id ?? data.id,
      platform: p.platform,
      status: p.status === "success" ? "published" : p.status ?? "published",
      postUrl: p.postUrl,
      platformPostId: p.platformPostId,
      scheduledAt: req.scheduledAt,
      publishedAt: p.publishedAt,
      error: p.error,
    }));

    return posts;
  }

  async deletePost(postId: string): Promise<{ deleted: boolean }> {
    await this.request("DELETE", `/post/${postId}`);
    return { deleted: true };
  }

  async getAnalytics(postId: string): Promise<PostAnalytics> {
    const data = await this.request<any>("GET", `/analytics/post/${postId}`);
    return {
      id: postId,
      platform: data.platform ?? "unknown",
      likes: data.likes ?? 0,
      comments: data.comments ?? 0,
      shares: data.shares ?? 0,
      impressions: data.impressions ?? 0,
      reach: data.reach ?? 0,
      clicks: data.clicks ?? 0,
      engagementRate: data.engagementRate ?? 0,
    };
  }

  async getHistory(options: {
    platform?: Platform;
    limit?: number;
  }): Promise<PostHistoryItem[]> {
    const params = new URLSearchParams();
    if (options.platform) params.set("platform", options.platform);
    if (options.limit) params.set("limit", String(options.limit));

    const qs = params.toString();
    const data = await this.request<any>(
      "GET",
      `/history${qs ? `?${qs}` : ""}`
    );

    return (data.posts ?? data ?? []).map((p: any) => ({
      id: p.id,
      platform: p.platform,
      text: p.post ?? p.text ?? "",
      status: p.status ?? "published",
      postUrl: p.postUrl,
      publishedAt: p.publishedAt,
      scheduledAt: p.scheduledAt,
    }));
  }

  async getProfiles(): Promise<ProfileInfo[]> {
    const data = await this.request<any>("GET", "/profiles");
    return (data.profiles ?? data ?? []).map((p: any) => ({
      platform: p.platform,
      username: p.username ?? p.handle ?? "",
      displayName: p.displayName,
      followers: p.followers,
      connected: p.connected ?? true,
    }));
  }

  async getComments(postId: string) {
    const data = await this.request<any>(
      "GET",
      `/comments/${postId}`
    );
    return (data.comments ?? data ?? []).map((c: any) => ({
      id: c.id,
      text: c.text ?? c.comment ?? "",
      author: c.author ?? c.username ?? "",
      createdAt: c.createdAt ?? "",
    }));
  }

  async uploadMedia(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ url: string }> {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append("file", blob, filename);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.profileKey) {
      headers["X-Profile-Key"] = this.profileKey;
    }

    const res = await fetch(`${BASE_URL}/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Late media upload failed (${res.status})`);
    }

    const data = (await res.json()) as any;
    return { url: data.url ?? data.mediaUrl };
  }
}
