"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CheckSquare,
  Edit3,
  GitBranch,
  Mail,
  RefreshCw,
  Trash2,
  Wand2,
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
  onRevise?: (
    approval: ApprovalRequestWithContext,
    instructions: string
  ) => Promise<void> | void;
  loading?: boolean;
};

/**
 * Action types that support inline revision. Must stay in sync with
 * DRAFT_FIELDS on the /api/admin/approvals/[id]/revise route.
 */
const REVISABLE_ACTION_TYPES = new Set([
  "outreach_reply",
  "video_clip",
  "send_email",
  "send_sms",
  "social_publish_post",
  "newsletter_draft",
  "proposal_draft",
  "ad_copy",
  "create_task",
  "run_research",
  "draft_content"
]);

/**
 * Per-action placeholder hints for the "ask the agent to revise" box.
 * Keep them concrete and specific — generic "make it better" prompts
 * don't give the LLM enough to latch onto.
 */
const REVISE_PLACEHOLDERS: Record<string, string> = {
  outreach_reply:
    "e.g. Too formal — sound more like a peer. Drop the disclaimer at the end.",
  video_clip:
    "e.g. The hook sounds too AI. Make it punchier and more specific.",
  send_email:
    "e.g. Shorter subject. Cut the body by half. Drop the corporate tone.",
  send_sms:
    "e.g. Cut it in half. Lead with the first name. No emoji.",
  social_publish_post:
    "e.g. Lead with the specific number, not the generic claim.",
  newsletter_draft:
    "e.g. Open with the story, move the offer to the P.S.",
  proposal_draft:
    "e.g. Trim by 30%. Replace jargon with plain English.",
  ad_copy:
    "e.g. Hook needs to call out the pain specifically. Punch up the CTA.",
  create_task:
    "e.g. Be more specific about deliverables and acceptance criteria.",
  run_research:
    "e.g. Narrow the scope to 2026 only. Exclude competitors named X and Y.",
  draft_content: "What should the agent change?"
};

function formatActionType(actionType: string) {
  return actionType.replaceAll("_", " ");
}

function getActionTypeMeta(actionType: string) {
  switch (actionType) {
    case "trigger_workflow":
      return {
        icon: GitBranch,
        className: "bg-steel/15 text-steel-bright"
      };
    case "send_email":
      return {
        icon: Mail,
        className: "bg-steel/15 text-steel-bright"
      };
    case "update_crm":
    case "create_task":
    case "change_schedule":
      return {
        icon: Edit3,
        className: "bg-state-warning/15 text-state-warning"
      };
    case "run_research":
      return {
        icon: Zap,
        className: "bg-bg-surface-2 text-ink-primary"
      };
    case "delete_data":
      return {
        icon: Trash2,
        className: "bg-state-danger/15 text-state-danger"
      };
    default:
      return {
        icon: CheckSquare,
        className: "bg-bg-surface-2 text-ink-primary"
      };
  }
}

function getStatusClasses(status: string) {
  switch (status) {
    case "pending":
      return {
        border: "border-l-[3px] border-l-brand-amber",
        badge: "bg-state-warning/15 text-state-warning"
      };
    case "approved":
      return {
        border: "border-l-[3px] border-l-status-active",
        badge: "bg-state-success/15 text-state-success"
      };
    case "rejected":
      return {
        border: "border-l-[3px] border-l-status-error",
        badge: "bg-state-danger/15 text-state-danger"
      };
    default:
      return {
        border: "border-l-[3px] border-l-slate-600 opacity-80",
        badge: "bg-bg-surface-2 text-ink-secondary"
      };
  }
}

function getExpiryInfo(expiresAt: Date | string) {
  const target = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const diffMs = target.getTime() - Date.now();

  if (diffMs <= 0) {
    return {
      label: "Expired",
      className: "text-state-danger"
    };
  }

  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 60) {
    return {
      label: `Expires in ${minutes} min`,
      className: minutes < 30 ? "text-state-danger" : "text-state-warning"
    };
  }

  const hours = Math.ceil(minutes / 60);
  return {
    label: `Expires in ${hours} hour${hours === 1 ? "" : "s"}`,
    className: hours < 2 ? "text-state-warning" : "text-ink-secondary"
  };
}

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  onRevise,
  loading = false
}: ApprovalCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState(approval.reason ?? "");
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseInstructions, setReviseInstructions] = useState("");
  const [busyAction, setBusyAction] = useState<
    "approve" | "reject" | "revise" | null
  >(null);
  const canRevise =
    Boolean(onRevise) && REVISABLE_ACTION_TYPES.has(approval.actionType);
  const revisionCount = (() => {
    const detail = approval.actionDetail;
    if (
      detail &&
      typeof detail === "object" &&
      !Array.isArray(detail) &&
      Array.isArray((detail as { revisions?: unknown }).revisions)
    ) {
      return ((detail as { revisions: unknown[] }).revisions ?? []).length;
    }
    return 0;
  })();
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

  async function handleRevise() {
    if (!onRevise || reviseInstructions.trim().length < 3) {
      return;
    }
    try {
      setBusyAction("revise");
      await onRevise(approval, reviseInstructions.trim());
      setReviseInstructions("");
      setReviseOpen(false);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div
      id={`approval-${approval.id}`}
      className={cn(
        "rounded-xl border border-line-subtle bg-bg-surface p-5 shadow-surface",
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
          <Badge className="bg-bg-surface-2 text-white">
            {formatActionType(approval.actionType)}
          </Badge>
          {approval.business ? (
            <Badge className="bg-bg-app text-ink-primary">
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
            <span className="inline-flex items-center gap-2 rounded-full border border-line-subtle bg-bg-app px-3 py-1 text-ink-primary">
              <span>{approval.agent.emoji ?? "AI"}</span>
              <span>{approval.agent.displayName}</span>
            </span>
          ) : null}

          {approval.workflow ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-line-subtle bg-bg-app px-3 py-1 text-ink-primary">
              <GitBranch className="h-3.5 w-3.5 text-steel-bright" />
              <span>{approval.workflow.name}</span>
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
            <span>Action details</span>
            {revisionCount > 0 ? (
              <Badge className="bg-steel/15 text-steel-bright">
                Revised ×{revisionCount}
              </Badge>
            ) : null}
          </div>
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
          <div className="space-y-1 text-sm text-ink-secondary">
            <div>
              Reviewed by {approval.reviewedBy ?? "Unknown"}{" "}
              {"-"} {formatRelativeTime(reviewedAt)}
            </div>
            {approval.reason ? (
              <div className="italic text-ink-muted">{approval.reason}</div>
            ) : null}
          </div>
        ) : null}

        {isPending ? (
          <div className="space-y-3 border-t border-line-subtle pt-4">
            {reviseOpen ? (
              <div className="space-y-3 rounded-xl border border-steel/25 bg-steel/5 p-3">
                <div className="text-sm font-medium text-white">
                  Ask the agent to revise
                </div>
                <p className="text-xs text-ink-secondary">
                  Tell the agent what to change. It will rewrite the draft in
                  place — you can revise as many times as you want before
                  approving.
                </p>
                <Textarea
                  value={reviseInstructions}
                  onChange={(event) => setReviseInstructions(event.target.value)}
                  placeholder={
                    REVISE_PLACEHOLDERS[approval.actionType] ??
                    "What should the agent change?"
                  }
                  className="min-h-[88px]"
                  disabled={busyAction === "revise"}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleRevise()}
                    disabled={
                      loading ||
                      busyAction !== null ||
                      reviseInstructions.trim().length < 3
                    }
                  >
                    {busyAction === "revise" ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Revising…
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Rewrite draft
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setReviseOpen(false);
                      setReviseInstructions("");
                    }}
                    disabled={busyAction === "revise"}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {rejectOpen ? (
              <div className="space-y-3 rounded-xl border border-status-error/25 bg-state-danger/5 p-3">
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
                className="bg-state-success text-white hover:brightness-110"
                onClick={() => void handleApprove()}
                disabled={loading || busyAction !== null}
              >
                <Check className="mr-2 h-4 w-4" />
                {busyAction === "approve" ? "Approving..." : "Approve"}
              </Button>
              {canRevise ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-steel/40 text-steel-bright hover:bg-steel/10"
                  onClick={() => {
                    setReviseOpen((current) => !current);
                    if (rejectOpen) setRejectOpen(false);
                  }}
                  disabled={loading || busyAction !== null}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  Revise
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="border-status-error/30 text-state-danger hover:bg-state-danger/10"
                onClick={() => {
                  setRejectOpen((current) => !current);
                  if (reviseOpen) setReviseOpen(false);
                }}
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
