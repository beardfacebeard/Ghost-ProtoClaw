"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  Edit3,
  GitBranch,
  Mail,
  Trash2,
  X,
  Zap
} from "lucide-react";

import { formatRelativeTime } from "@/components/admin/ActivityFeed";
import { JsonViewer } from "@/components/admin/JsonViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ApprovalRequestWithContext = {
  id: string;
  businessId: string;
  agentId: string | null;
  workflowId: string | null;
  actionType: string;
  actionDetail: unknown;
  status: string;
  requestedBy: string | null;
  reviewedBy: string | null;
  reason: string | null;
  expiresAt: Date | string;
  reviewedAt: Date | string | null;
  createdAt: Date | string;
  business: {
    id: string;
    name: string;
  } | null;
  agent: {
    id: string;
    displayName: string;
    emoji: string | null;
  } | null;
  workflow: {
    id: string;
    name: string;
  } | null;
};

type ApprovalCardProps = {
  approval: ApprovalRequestWithContext;
  onApprove: (approval: ApprovalRequestWithContext) => Promise<void> | void;
  onReject: (
    approval: ApprovalRequestWithContext,
    reason: string
  ) => Promise<void> | void;
  loading?: boolean;
};

function formatActionType(actionType: string) {
  return actionType.replaceAll("_", " ");
}

function getActionTypeMeta(actionType: string) {
  switch (actionType) {
    case "trigger_workflow":
      return {
        icon: GitBranch,
        className: "bg-brand-cyan/15 text-brand-cyan"
      };
    case "send_email":
      return {
        icon: Mail,
        className: "bg-status-info/15 text-status-info"
      };
    case "update_crm":
    case "create_task":
    case "change_schedule":
      return {
        icon: Edit3,
        className: "bg-brand-amber/15 text-brand-amber"
      };
    case "run_research":
      return {
        icon: Zap,
        className: "bg-ghost-raised text-slate-300"
      };
    case "delete_data":
      return {
        icon: Trash2,
        className: "bg-status-error/15 text-status-error"
      };
    default:
      return {
        icon: CheckSquare,
        className: "bg-ghost-raised text-slate-300"
      };
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case "pending":
      return {
        border: "border-l-[3px] border-l-brand-amber",
        badge: "bg-brand-amber/15 text-brand-amber"
      };
    case "approved":
      return {
        border: "border-l-[3px] border-l-status-active",
        badge: "bg-status-active/15 text-status-active"
      };
    case "rejected":
      return {
        border: "border-l-[3px] border-l-status-error",
        badge: "bg-status-error/15 text-status-error"
      };
    default:
      return {
        border: "border-l-[3px] border-l-slate-600 opacity-80",
        badge: "bg-ghost-raised text-slate-400"
      };
  }
}

function getExpiryInfo(expiresAt: Date | string) {
  const target = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const diffMs = target.getTime() - Date.now();

  if (diffMs <= 0) {
    return {
      label: "Expired",
      className: "text-status-error"
    };
  }

  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 60) {
    return {
      label: `Expires in ${minutes} min`,
      className: minutes < 30 ? "text-status-error" : "text-brand-amber"
    };
  }

  const hours = Math.ceil(minutes / 60);
  return {
    label: `Expires in ${hours} hour${hours === 1 ? "" : "s"}`,
    className: hours < 2 ? "text-brand-amber" : "text-slate-400"
  };
}

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  loading = false
}: ApprovalCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState(approval.reason ?? "");
  const [busyAction, setBusyAction] = useState<"approve" | "reject" | null>(null);
  const actionMeta = useMemo(
    () => getActionTypeMeta(approval.actionType),
    [approval.actionType]
  );
  const statusMeta = useMemo(
    () => getStatusClasses(approval.status),
    [approval.status]
  );
  const expiryInfo = useMemo(
    () => getExpiryInfo(approval.expiresAt),
    [approval.expiresAt]
  );
  const ActionIcon = actionMeta.icon;
  const isPending = approval.status === "pending";
  const reviewedAt = approval.reviewedAt
    ? typeof approval.reviewedAt === "string"
      ? new Date(approval.reviewedAt)
      : approval.reviewedAt
    : null;

  async function handleApprove() {
    try {
      setBusyAction("approve");
      await onApprove(approval);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject() {
    if (rejectReason.trim().length === 0) {
      return;
    }

    try {
      setBusyAction("reject");
      await onReject(approval, rejectReason.trim());
      setRejectOpen(false);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div
      id={`approval-${approval.id}`}
      className={cn(
        "rounded-xl border border-ghost-border bg-ghost-surface p-5 shadow-surface",
        statusMeta.border
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              actionMeta.className
            )}
          >
            <ActionIcon className="h-4 w-4" />
          </div>
          <Badge className="bg-ghost-raised text-white">
            {formatActionType(approval.actionType)}
          </Badge>
          {approval.business ? (
            <Badge className="bg-ghost-black text-slate-300">
              {approval.business.name}
            </Badge>
          ) : null}
        </div>

        <Badge className={statusMeta.badge}>
          {approval.status.charAt(0).toUpperCase() + approval.status.slice(1)}
        </Badge>
      </div>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {approval.agent ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-ghost-border bg-ghost-black px-3 py-1 text-slate-300">
              <span>{approval.agent.emoji ?? "AI"}</span>
              <span>{approval.agent.displayName}</span>
            </span>
          ) : null}

          {approval.workflow ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-ghost-border bg-ghost-black px-3 py-1 text-slate-300">
              <GitBranch className="h-3.5 w-3.5 text-brand-cyan" />
              <span>{approval.workflow.name}</span>
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-white">Action details</div>
          <JsonViewer
            data={approval.actionDetail ?? {}}
            collapsed
            collapsedLabel="Show details"
            expandedLabel="Hide details"
            maxHeight={240}
          />
        </div>

        {isPending ? (
          <div
            className={cn("text-sm font-medium", expiryInfo.className)}
            title={new Date(approval.expiresAt).toLocaleString()}
          >
            {expiryInfo.label}
          </div>
        ) : reviewedAt ? (
          <div className="space-y-1 text-sm text-slate-400">
            <div>
              Reviewed by {approval.reviewedBy ?? "Unknown"}{" "}
              {"-"} {formatRelativeTime(reviewedAt)}
            </div>
            {approval.reason ? (
              <div className="italic text-slate-500">{approval.reason}</div>
            ) : null}
          </div>
        ) : null}

        {isPending ? (
          <div className="space-y-3 border-t border-ghost-border pt-4">
            {rejectOpen ? (
              <div className="space-y-3 rounded-xl border border-status-error/25 bg-status-error/5 p-3">
                <div className="text-sm font-medium text-white">
                  Reason for rejection
                </div>
                <Textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Reason for rejection (required)"
                  className="min-h-[88px]"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleReject()}
                    disabled={
                      loading || busyAction !== null || rejectReason.trim().length === 0
                    }
                  >
                    <X className="mr-2 h-4 w-4" />
                    {busyAction === "reject" ? "Rejecting..." : "Confirm Reject"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setRejectOpen(false);
                      setRejectReason(approval.reason ?? "");
                    }}
                    disabled={loading || busyAction !== null}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-status-active text-white hover:brightness-110"
                onClick={() => void handleApprove()}
                disabled={loading || busyAction !== null}
              >
                <Check className="mr-2 h-4 w-4" />
                {busyAction === "approve" ? "Approving..." : "Approve"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-status-error/30 text-status-error hover:bg-status-error/10"
                onClick={() => setRejectOpen((current) => !current)}
                disabled={loading || busyAction !== null}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
