"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
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

export type VideoClipTarget = {
  id: string;
  businessId: string;
  businessName: string;
  status: string;
  createdAt: string;
  metadata: {
    videoUrl?: string;
    videoTitle?: string;
    startSec?: number;
    endSec?: number;
    startLabel?: string;
    endLabel?: string;
    durationSec?: number;
    hookLine?: string;
    caption?: string;
    transcriptExcerpt?: string;
    targetPlatform?: string;
    aspectRatio?: string;
    reasoning?: string;
    score?: number | null;
  };
};

type Props = {
  targets: VideoClipTarget[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  used: "Used",
  dismissed: "Dismissed"
};

const STATUS_ORDER = ["pending", "used", "dismissed"];

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: "🎵",
  shorts: "▶️",
  reels: "📸",
  x: "🧵",
  linkedin: "💼",
  other: "🎬"
};

function formatRange(meta: VideoClipTarget["metadata"]): string {
  if (meta.startLabel && meta.endLabel) {
    return `${meta.startLabel}–${meta.endLabel}`;
  }
  if (
    typeof meta.startSec === "number" &&
    typeof meta.endSec === "number"
  ) {
    const fmt = (s: number) =>
      `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    return `${fmt(meta.startSec)}–${fmt(meta.endSec)}`;
  }
  return "—";
}

export function VideoClipsClient({ targets }: Props) {
  const [items, setItems] = useState(targets);
  const [status, setStatus] = useState<string>("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => items.filter((item) => item.status === status),
    [items, status]
  );

  const counts = useMemo(() => {
    const out: Record<string, number> = {
      pending: 0,
      used: 0,
      dismissed: 0
    };
    for (const item of items) {
      out[item.status] = (out[item.status] ?? 0) + 1;
    }
    return out;
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
    action: "used" | "dismissed" | "pending"
  ) {
    setUpdatingId(id);
    try {
      const response = await fetchWithCsrf(`/api/admin/clips/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "Update failed");
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: action } : item
        )
      );
      toast.success(
        action === "used"
          ? "Marked as used."
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

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied.`);
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
            <SelectTrigger className="mt-1 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s] ?? s} ({counts[s] ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-ink-muted">
          {status === "pending"
            ? "No pending clip suggestions. Install the Video-to-Shorts Clip Miner workflow, or give your agent a YouTube URL in chat and ask them to mine it for clips."
            : `No ${STATUS_LABELS[status]?.toLowerCase() ?? status} clips.`}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((clip) => {
            const meta = clip.metadata;
            const range = formatRange(meta);
            const platformKey =
              (meta.targetPlatform ?? "tiktok").toLowerCase();
            const icon = PLATFORM_ICONS[platformKey] ?? "🎬";
            const isExpanded = expanded.has(clip.id);
            const transcript = meta.transcriptExcerpt ?? "";
            const caption = meta.caption ?? "";
            const showTranscript = isExpanded
              ? transcript
              : transcript.length > 220
                ? transcript.slice(0, 220) + "…"
                : transcript;
            const showCaption = isExpanded
              ? caption
              : caption.length > 220
                ? caption.slice(0, 220) + "…"
                : caption;
            return (
              <Card key={clip.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="admin">
                          {icon} {platformKey}
                        </Badge>
                        <Badge variant="active">{range}</Badge>
                        {typeof meta.durationSec === "number" ? (
                          <Badge variant="default">
                            {meta.durationSec}s
                          </Badge>
                        ) : null}
                        {meta.aspectRatio ? (
                          <Badge variant="default">{meta.aspectRatio}</Badge>
                        ) : null}
                        {typeof meta.score === "number" ? (
                          <Badge variant="active">Score {meta.score}/10</Badge>
                        ) : null}
                        <Badge variant="default">{clip.businessName}</Badge>
                        <span className="text-[11px] text-ink-muted">
                          {new Date(clip.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <h3 className="mt-2 font-semibold text-sm leading-snug">
                        {meta.videoTitle ?? "Untitled video"}
                      </h3>
                      {meta.hookLine ? (
                        <p className="mt-1 text-sm text-steel-bright">
                          Hook: {meta.hookLine}
                        </p>
                      ) : null}
                    </div>
                    {meta.videoUrl ? (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={meta.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open video
                        </a>
                      </Button>
                    ) : null}
                  </div>

                  {meta.reasoning ? (
                    <p className="text-xs text-ink-muted italic">
                      Why: {meta.reasoning}
                    </p>
                  ) : null}

                  {transcript ? (
                    <div className="rounded border bg-muted/30 p-2 text-xs whitespace-pre-wrap">
                      <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">
                        Transcript ({range})
                      </div>
                      {showTranscript}
                    </div>
                  ) : null}

                  {caption ? (
                    <div className="rounded border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap">
                      <div className="text-[10px] uppercase tracking-wider text-primary/70 mb-1">
                        Caption draft
                      </div>
                      {showCaption}
                    </div>
                  ) : null}

                  {(transcript.length > 220 || caption.length > 220) && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(clip.id)}
                      className="text-xs underline text-ink-muted hover:text-foreground"
                    >
                      {isExpanded ? "Show less" : "Show full"}
                    </button>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(range, "Timestamps")}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy timestamps
                    </Button>
                    {caption ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyText(caption, "Caption")}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy caption
                      </Button>
                    ) : null}
                    {clip.status === "pending" ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => updateStatus(clip.id, "used")}
                          disabled={updatingId === clip.id}
                        >
                          {updatingId === clip.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          )}
                          Mark used
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateStatus(clip.id, "dismissed")}
                          disabled={updatingId === clip.id}
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
                        onClick={() => updateStatus(clip.id, "pending")}
                        disabled={updatingId === clip.id}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Return to pending
                      </Button>
                    )}
                    {clip.status === "used" ? (
                      <Badge variant="active">Used</Badge>
                    ) : clip.status === "dismissed" ? (
                      <Badge variant="default">Dismissed</Badge>
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
