import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Premium page header used across every admin page after the 2026
 * redesign. Mono eyebrow (section name / breadcrumb) → big display-font
 * title → optional description → optional actions cluster on the right.
 *
 * Pages that previously used `<SectionHeader />` can keep using that;
 * it was restyled to match. Use this one when you want the extra
 * typographic weight — dashboard, Today, Chat, etc.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className
}: {
  /** Small uppercase label above the title (e.g. "Team · Agents"). */
  eyebrow?: string;
  /** The h1 itself. Keep to a single sentence or noun phrase. */
  title: string;
  /** 1–2 sentence explainer. Optional. */
  description?: string;
  /** Right-aligned actions (buttons, links). */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-ink-primary md:text-[28px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
