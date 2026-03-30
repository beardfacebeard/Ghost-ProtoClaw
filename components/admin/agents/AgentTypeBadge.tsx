import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AgentTypeBadgeProps = {
  type: "main" | "specialist" | "global";
  className?: string;
};

export function AgentTypeBadge({ type, className }: AgentTypeBadgeProps) {
  if (type === "main") {
    return (
      <Badge className={cn("bg-brand-amber text-ghost-black", className)}>
        👑 Main
      </Badge>
    );
  }

  if (type === "specialist") {
    return (
      <Badge className={cn("bg-status-info/15 text-status-info", className)}>
        🎯 Specialist
      </Badge>
    );
  }

  return (
    <Badge className={cn("bg-ghost-raised text-slate-300", className)}>
      🌐 Global
    </Badge>
  );
}
