"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquareDashed,
  RotateCcw,
  XCircle
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

export type OutreachPlatform =
  | "reddit"
  | "hackernews"
  | "stackoverflow"
  | "github"
  | "other";

export type OutreachTarget = {
  id: string;
  businessId: string;
  businessName: string;
  status: string;
  createdAt: string;
  platform: OutreachPlatform;
  metadata: {
    url?: string;
    platform?: string;
    community?: string;
    subreddit?: string;
    postTitle?: string;
    postExcerpt?: string;
    draftReply?: string;
    reasoning?: string;
    score?: number | null;
    authorHandle?: string;
    platformExtras?: Record<string, unknown>;
  };
};

type Props = {
  targets: OutreachTarget[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved (awaiting posting)",
  posted: "Posted",
  dismissed: "Dismissed"
};

const STATUS_ORDER: string[] = ["pending", "approved", "posted", "dismissed"];

const PLATFORM_LABELS: Record<OutreachPlatform, string> = {
  reddit: "Reddit",
  hackernews: "Hacker News",
  stackoverflow: "Stack Overflow",
  github: "GitHub",
  other: "Other"
};

const PLATFORM_ICONS: Record<OutreachPlatform, string> = {
  reddit: "👾",
  hackernews: "🔶",
  stackoverflow: "📚",
  github: "🐙",
  other: "🎯"
};

const ALL_PLATFORMS = "__all__";

function communityLabel(target: OutreachTarget): string {
  const meta = target.metadata;
  const community = meta.community ?? meta.subreddit ?? "";
  if (!community) return "";
  if (target.platform === "reddit") return `r/${community}`;
  return community;
}

export function OutreachTargetsClient({ targets }: Props) {
  const [items, setItems] = useState(targets);
  const [status, setStatus] = useState<string>("pending");
  const [platform, setPlatform] = useState<string>(ALL_PLATFORMS);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (item.status !== status) return false;
        if (platform !== ALL_PLATFORMS && item.platform !== platform)
          return false;
        return true;
      }),
    [items, status, platform]
  );

  const statusCounts = useMemo(() => {
    const out: Record<string, number> = { pending: 0, posted: 0, dismissed: 0 };
    for (const item of items) {
      if (platform !== ALL_PLATFORMS && item.platform !== platform) continue;
      out[item.status] = (out[item.status] ?? 0) + 1;
    }
    return out;
  }, [items, platform]);

  const platformCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const item of items) {
      if (item.status !== status) continue;
      out[item.platform] = (out[item.platform] ?? 0) + 1;
    }
    return out;
  }, [items, status]);

  const availablePlatforms = useMemo(() => {
    const set = new Set<OutreachPlatform>();
    for (const item of items) set.add(item.platform);
    return Array.from(set);
  }, [items]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function updateStatus(
    id: string,
    action: "approved" | "posted" | "dismissed" | "pending"
  ) {
    setUpdatingId(id);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/outreach/targets/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action })
        }
      );
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Update failed");
      }
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: action } : item))
      );
      toast.success(
        action === "posted"
          ? "Marked as posted."
          : action === "dismissed"
            ? "Dismissed."
            : "Returned to pending."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function copyDraft(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Draft copied.");
    } catch {
      toast.error("Clipboard not available.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s] ?? s} ({statusCounts[s] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Platform</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="mt-1 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_PLATFORMS}>
                All platforms ({Object.values(platformCounts).reduce((a, b) => a + b, 0)})
              </SelectItem>
              {availablePlatforms.map((p) => (
                <SelectItem key={p} value={p}>
                  {PLATFORM_ICONS[p]} {PLATFORM_LABELS[p]} ({platformCounts[p] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-ink-muted">
          {status === "pending"
            ? "No pending outreach targets yet. Install a scanner workflow (Reddit Audience Scanner, HN Signal Scanner, Stack Overflow Pain Scanner, or GitHub Competitor Issue Radar) and give it a few hours."
            : `No ${STATUS_LABELS[status]?.toLowerCase() ?? status} targets for the current filters.`}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((target) => {
            const meta = target.metadata;
            const isExpanded = expanded.has(target.id);
            const draft = meta.draftReply ?? "";
            const excerpt = meta.postExcerpt ?? "";
            const showDraft = isExpanded
              ? draft
              : draft.length > 240
                ? draft.slice(0, 240) + "…"
                : draft;
            const showExcerpt = isExpanded
              ? excerpt
              : excerpt.length > 200
                ? excerpt.slice(0, 200) + "…"
                : excerpt;
            const community = communityLabel(target);
            return (
              <Card key={target.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="admin">
                          {PLATFORM_ICONS[target.platform]}{" "}
                          {PLATFORM_LABELS[target.platform]}
                        </Badge>
                        {community ? (
                          <Badge variant="default">{community}</Badge>
                        ) : null}
                        {typeof meta.score === "number" ? (
                          <Badge variant="active">Score {meta.score}/10</Badge>
                        ) : null}
                        <Badge variant="default">{target.businessName}</Badge>
                        <span className="text-[11px] text-ink-muted">
                          {new Date(target.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="mt-2 font-semibold text-sm leading-snug">
                        {meta.postTitle ?? "(untitled)"}
                      </h3>
                      {meta.authorHandle ? (
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          by {target.platform === "reddit" ? "u/" : "@"}
                          {meta.authorHandle}
                        </p>
                      ) : null}
                    </div>
                    {meta.url ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={meta.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open
                        </a>
                      </Button>
                    ) : null}
                  </div>

                  {meta.reasoning ? (
                    <p className="text-xs text-ink-muted italic">
                      Why: {meta.reasoning}
                    </p>
                  ) : null}

                  {excerpt ? (
                    <div className="rounded border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                      <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">
                        Excerpt
                      </div>
                      {showExcerpt}
                    </div>
                  ) : null}

                  <div className="rounded border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap">
                    <div className="text-[10px] uppercase tracking-wider text-primary/70 mb-1">
                      Draft reply
                    </div>
                    {showDraft}
                  </div>

                  {(draft.length > 240 || excerpt.length > 200) && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(target.id)}
                      className="text-xs underline text-ink-muted hover:text-foreground"
                    >
                      {isExpanded ? "Show less" : "Show full draft"}
                    </button>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyDraft(draft)}
                      disabled={!draft}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy draft
                    </Button>
                    {(target.status === "pending" ||
                      target.status === "approved") ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => updateStatus(target.id, "posted")}
                          disabled={updatingId === target.id}
                          title="I went to the platform and posted this myself — mark it posted."
                        >
                          {updatingId === target.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          )}
                          I posted it
                        </Button>
                        {target.status === "pending" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => updateStatus(target.id, "approved")}
                            disabled={updatingId === target.id}
                            title="I'll post this later — save it as approved and keep it out of the pending queue."
                          >
                            Approve (post later)
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(target.id, "dismissed")}
                          disabled={updatingId === target.id}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus(target.id, "pending")}
                        disabled={updatingId === target.id}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Return to pending
                      </Button>
                    )}
                    {target.status === "posted" ? (
                      <Badge variant="active">Posted</Badge>
                    ) : target.status === "approved" ? (
                      <Badge variant="amber">Approved — awaiting posting</Badge>
                    ) : target.status === "dismissed" ? (
                      <Badge variant="default">
                        <MessageSquareDashed className="h-3 w-3 mr-1" />
                        Dismissed
                      </Badge>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
