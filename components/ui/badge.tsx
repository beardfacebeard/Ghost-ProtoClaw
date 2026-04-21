import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Shared Badge primitive. 2026 redesign: tighter sizing, rounded-md
 * (not full-pill) for a more editorial feel, tinted backgrounds
 * (10-15% alpha) instead of solid color blocks.
 *
 * Variants map to the new state tokens. "admin" (steel blue) replaces
 * the old red variant. "amber" is kept for the warning tier.
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-line bg-bg-surface-2 text-ink-secondary",
        active:
          "border-state-success/30 bg-state-success/15 text-state-success",
        admin:
          "border-steel/30 bg-steel/10 text-steel-bright",
        amber:
          "border-state-warning/30 bg-state-warning/15 text-state-warning",
        info: "border-steel/30 bg-steel/10 text-steel-bright",
        error:
          "border-state-danger/30 bg-state-danger/10 text-state-danger",
        ai:
          "border-state-ai/30 bg-state-ai/10 text-state-ai"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
