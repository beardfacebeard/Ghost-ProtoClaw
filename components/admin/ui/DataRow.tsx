import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One row in a dense data list. Used for activity feeds, log tables,
 * approval queues, etc. Three slots:
 *   - leading: status dot or small icon
 *   - content: primary text + optional secondary line (monochrome)
 *   - trailing: timestamp or right-aligned metadata (mono)
 *
 * Apply inside a Panel with `<PanelBody />` stripped. Rows self-manage
 * horizontal padding and a subtle divide-y line.
 */
export function DataRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  className
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const body = (
    <>
      {leading ? (
        <div className="flex flex-shrink-0 items-center">{leading}</div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-ink-primary">{title}</div>
        {subtitle ? (
          <div className="truncate text-[11px] text-ink-muted">{subtitle}</div>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex-shrink-0 font-mono text-[10.5px] text-ink-muted">
          {trailing}
        </div>
      ) : null}
    </>
  );

  const classes = cn(
    "flex items-center gap-3 px-4 py-2.5 transition-colors duration-150",
    (href || onClick) && "cursor-pointer hover:bg-bg-surface-2",
    className
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {body}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, "w-full text-left")}>
        {body}
      </button>
    );
  }

  return <div className={classes}>{body}</div>;
}
