import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Standard empty state used across list pages (no agents yet, no
 * approvals, no knowledge items, etc.). Stays calm and directive —
 * small monochrome icon, tight copy, optional single CTA.
 *
 * Don't use illustrations. Don't use stock art. Just typography and
 * one call to action. That's the premium feel.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?:
    | { label: string; href: string }
    | { label: string; onClick: () => void }
    | ReactNode;
  className?: string;
}) {
  const actionNode = (() => {
    if (!action) return null;
    if (
      typeof action === "object" &&
      action !== null &&
      !Array.isArray(action) &&
      "label" in action
    ) {
      const label = (action as { label: string }).label;
      if ("href" in action && typeof action.href === "string") {
        return (
          <Link
            href={action.href}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-steel/30 bg-steel/10 px-3 py-1.5 text-[12px] font-medium text-steel-bright transition hover:border-steel/60 hover:bg-steel/20"
          >
            {label} →
          </Link>
        );
      }
      if ("onClick" in action && typeof action.onClick === "function") {
        return (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-steel/30 bg-steel/10 px-3 py-1.5 text-[12px] font-medium text-steel-bright transition hover:border-steel/60 hover:bg-steel/20"
          >
            {label} →
          </button>
        );
      }
    }
    return <div className="mt-4">{action as ReactNode}</div>;
  })();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line-subtle bg-bg-surface/60 px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-bg-surface-2 text-ink-muted">
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </div>
      ) : null}
      <div className="text-[14px] font-medium text-ink-primary">{title}</div>
      {description ? (
        <div className="mt-1 max-w-md text-[12px] leading-relaxed text-ink-muted">
          {description}
        </div>
      ) : null}
      {actionNode}
    </div>
  );
}
