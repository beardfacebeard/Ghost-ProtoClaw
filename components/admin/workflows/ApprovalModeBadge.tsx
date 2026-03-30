import { Badge } from "@/components/ui/badge";

import { getApprovalModeMeta } from "@/components/admin/workflows/utils";

type ApprovalModeBadgeProps = {
  mode: string;
};

export function ApprovalModeBadge({ mode }: ApprovalModeBadgeProps) {
  const meta = getApprovalModeMeta(mode);
  const Icon = meta.icon;

  return (
    <Badge className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
    </Badge>
  );
}
