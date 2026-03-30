import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { getTriggerMeta } from "@/components/admin/workflows/utils";

type TriggerBadgeProps = {
  trigger: string;
  size?: "sm" | "md";
};

export function TriggerBadge({ trigger, size = "md" }: TriggerBadgeProps) {
  const meta = getTriggerMeta(trigger);
  const Icon = meta.icon;

  return (
    <Badge
      className={cn(
        "inline-flex items-center gap-1.5 font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        meta.className
      )}
    >
      <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5", meta.iconClassName)} />
      <span>{meta.label}</span>
    </Badge>
  );
}
