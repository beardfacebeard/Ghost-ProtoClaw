import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Base panel — the bento-box card the redesign uses everywhere.
 * bg-surface with a 1px line-subtle border. No heavy shadow —
 * depth comes from the layered surfaces behind it.
 *
 * Variants:
 *   default — resting state, no accent.
 *   live    — active/running state. Adds a thin steel-bright top
 *             edge glow so the eye knows something is happening
 *             inside. Used on "Now Running" panels and the like.
 *   danger  — subtle state-danger tint on border. Used for panels
 *             surfacing failures the user needs to acknowledge.
 */
export function Panel({
  children,
  variant = "default",
  className,
  interactive
}: {
  children: ReactNode;
  variant?: "default" | "live" | "danger";
  className?: string;
  /** When true, adds hover border-brighten. Use for panels that link out. */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-bg-surface",
        variant === "default" && "border-line-subtle",
        variant === "live" && "border-steel/25",
        variant === "danger" && "border-state-danger/30 bg-state-danger/5",
        interactive &&
          "transition-colors duration-150 hover:border-line hover:bg-bg-surface-2",
        className
      )}
    >
      {variant === "live" ? (
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-steel to-transparent opacity-60"
        />
      ) : null}
      {children}
    </div>
  );
}

/**
 * Standard panel header. Small uppercase label on the left, optional
 * action on the right. 1px bottom divider.
 */
export function PanelHeader({
  label,
  action,
  className
}: {
  label: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-line-subtle px-4 py-2.5",
        className
      )}
    >
      <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">
        {label}
      </span>
      {action ? (
        <div className="flex items-center gap-2">{action}</div>
      ) : null}
    </div>
  );
}

/** Panel body with standardized padding. Skip if you want custom padding. */
export function PanelBody({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
