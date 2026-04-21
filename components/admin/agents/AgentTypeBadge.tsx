import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AgentTypeBadgeProps = {
  type: "main" | "specialist" | "global";
  className?: string;
};

export function AgentTypeBadge({ type, className }: AgentTypeBadgeProps) {
  if (type === "main") {
    return (
      <Badge className={cn("bg-state-warning text-bg-app", className)}>
        👑 Main
      </Badge>
    );
  }

  if (type === "specialist") {
    return (
      <Badge className={cn("bg-steel/15 text-steel-bright", className)}>
        🎯 Specialist
      </Badge>
    );
  }

  return (
    <Badge className={cn("bg-bg-surface-2 text-ink-primary", className)}>
      🌐 Global
    </Badge>
  );
}
