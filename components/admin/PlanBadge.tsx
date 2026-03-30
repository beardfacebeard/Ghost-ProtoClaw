import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type PlanBadgeProps = {
  planTier: string;
};

const planTierMap: Record<
  string,
  { label: string; className: string; showStar?: boolean }
> = {
  founding_concierge: {
    label: "Founding Concierge",
    className: "bg-brand-amber text-ghost-black",
    showStar: true
  },
  founding_setup: {
    label: "Founding Setup",
    className: "bg-brand-primary/15 text-brand-primary border border-brand-primary/25"
  },
  hosted: {
    label: "Hosted",
    className: "bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/25"
  },
  app_only: {
    label: "App Only",
    className: "bg-ghost-raised text-zinc-400 border border-ghost-border"
  }
};

export function PlanBadge({ planTier }: PlanBadgeProps) {
  const config = planTierMap[planTier] ?? {
    label: "Unknown Plan",
    className: "bg-ghost-raised text-zinc-400 border border-ghost-border"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        config.className
      )}
    >
      {config.showStar ? <Star className="h-3 w-3 fill-current" /> : null}
      <span>{config.label}</span>
    </span>
  );
}
