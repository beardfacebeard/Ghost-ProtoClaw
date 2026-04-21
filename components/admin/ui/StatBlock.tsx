import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The single stat card used across dashboards and list headers in the
 * 2026 redesign. Small uppercase label (mono), large display-weight
 * number, optional icon and subtext. Supports tonal variants for
 * warnings and an href for navigable stats.
 */
export function StatBlock({
  label,
  value,
  icon,
  subtext,
  mono,
  href,
  tone = "default",
  className
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  subtext?: string;
  /** Render the value in Geist Mono. Use for money, time, counts > 5 digits. */
  mono?: boolean;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
  className?: string;
}) {
  const inner = (
    <div
      className={cn(
        "group relative rounded-lg border bg-bg-surface p-4 transition-all duration-150",
        "border-line-subtle",
        href && "hover:border-line hover:bg-bg-surface-2",
        tone === "warning" && "border-state-warning/25",
        tone === "danger" && "border-state-danger/30 bg-state-danger/5",
        tone === "success" && "border-state-success/20",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-ink-muted">
          {label}
        </span>
        {icon ? (
          <span
            className={cn(
              "transition-colors duration-150",
              tone === "warning" && "text-state-warning",
              tone === "danger" && "text-state-danger",
              tone === "success" && "text-state-success",
              tone === "default" &&
                "text-ink-muted group-hover:text-steel-bright"
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "text-[28px] font-semibold leading-none tracking-tight text-ink-primary",
          mono && "font-mono tracking-[-0.02em]"
        )}
      >
        {value}
      </div>
      {subtext ? (
        <div className="mt-1.5 text-[11px] text-ink-muted">{subtext}</div>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
