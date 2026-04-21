"use client";

import Link from "next/link";
import type { ActivityEntry } from "@prisma/client";
import {
  Activity,
  Archive,
  Bot,
  CheckSquare,
  GitBranch,
  Settings
} from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { cn } from "@/lib/utils";

type ActivityFeedItem = Pick<
  ActivityEntry,
  "id" | "type" | "title" | "detail" | "createdAt"
> & {
  createdAt: Date | string;
};

type ActivityFeedProps = {
  items: ActivityFeedItem[];
  showViewAll?: boolean;
};

function activityStyles(type: string) {
  switch (type) {
    case "workflow":
      return {
        icon: GitBranch,
        className: "bg-steel/15 text-steel-bright"
      };
    case "approval":
      return {
        icon: CheckSquare,
        className: "bg-state-warning/15 text-state-warning"
      };
    case "backup":
      return {
        icon: Archive,
        className: "bg-bg-surface-2 text-ink-secondary"
      };
    case "agent":
      return {
        icon: Bot,
        className: "bg-steel/15 text-steel-bright"
      };
    case "system":
      return {
        icon: Settings,
        className: "bg-bg-surface-2 text-ink-secondary"
      };
    default:
      return {
        icon: Activity,
        className: "bg-bg-surface-2 text-ink-secondary"
      };
  }
}

export function formatRelativeTime(date: Date | string) {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - target.getTime();

  if (diffMs < 60_000) {
    return "Just now";
  }

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (hours < 48) {
    return "Yesterday";
  }

  return target.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export function ActivityFeed({
  items,
  showViewAll = false
}: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        title="No activity yet"
        description="When workflows run, approvals move, or systems change, your activity timeline will appear here."
      />
    );
  }

  return (
    <div className="rounded-xl border border-line-subtle bg-bg-surface">
      <div className="flex items-center justify-between border-b border-line-subtle px-5 py-4">
        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
        {showViewAll ? (
          <Link
            href="/admin/activity"
            className="text-sm text-ink-secondary transition-colors hover:text-white"
          >
            View all
          </Link>
        ) : null}
      </div>
      <div className="divide-y divide-line-subtle">
        {items.map((item) => {
          const style = activityStyles(item.type);
          const Icon = style.icon;

          return (
            <div
              key={item.id}
              className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-bg-surface-2/40"
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  style.className
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-sm font-medium text-white">{item.title}</div>
                {item.detail ? (
                  <div className="text-sm leading-5 text-ink-secondary">
                    {item.detail}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-xs text-ink-muted">
                {formatRelativeTime(item.createdAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
