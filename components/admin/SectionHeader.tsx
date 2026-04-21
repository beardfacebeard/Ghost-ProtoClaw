import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  eyebrow?: string;
  className?: string;
};

/**
 * Shared section header used by most admin pages. 2026 redesign:
 * mono eyebrow → display-font title → optional description + actions
 * cluster. 1px line-subtle bottom divider. Premium and quiet.
 *
 * For the flagship dashboard/Today pages, prefer the richer
 * `<PageHeader />` from @/components/admin/ui instead. This one is
 * the everyday workhorse.
 */
export function SectionHeader({
  title,
  description,
  action,
  eyebrow,
  className
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-line-subtle pb-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="font-display text-[22px] font-semibold leading-tight tracking-tight text-ink-primary md:text-[24px]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-[13px] leading-relaxed text-ink-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
