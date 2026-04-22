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
import { ForexOrderCard } from "@/components/admin/approvals/ForexOrderCard";
import { StatusDot } from "@/components/admin/ui";
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
      return { icon: GitBranch, iconClass: "text-steel-bright" };
    case "send_email":
      return { icon: Mail, iconClass: "text-steel-bright" };
    case "update_crm":
    case "create_task":
    case "change_schedule":
      return { icon: Edit3, iconClass: "text-state-warning" };
    case "run_research":
      return { icon: Zap, iconClass: "text-ink-secondary" };
    case "delete_data":
      return { icon: Trash2, iconClass: "text-state-danger" };
    default:
      return { icon: CheckSquare, iconClass: "text-ink-secondary" };
  }
}

function getStatusMeta(status: string): {
  label: string;
  tone: "warning" | "success" | "danger" | "muted";
  accent: string;
  pill: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        tone: "warning",
        accent: "before:bg-state-warning",
        pill: "border-state-warning/30 bg-state-warning/10 text-state-warning"
      };
    case "approved":
      return {
        label: "Approved",
        tone: "success",
        accent: "before:bg-state-success",
        pill: "border-state-success/30 bg-state-success/10 text-state-success"
      };
    case "rejected":
      return {
        label: "Rejected",
        tone: "danger",
        accent: "before:bg-state-danger",
        pill: "border-state-danger/30 bg-state-danger/10 text-state-danger"
      };
    default:
      return {
        label: status.charAt(0).toUpperCase() + status.slice(1),
        tone: "muted",
        accent: "before:bg-line",
        pill: "border-line-subtle bg-bg-surface-2 text-ink-secondary"
      };
  }
}

function getExpiryInfo(expiresAt: Date | string) {
  const target = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const diffMs = target.getTime() - Date.now();

  if (diffMs <= 0) {
    return {
      label: "Expired",
      className: "text-state-danger",
      tone: "danger" as const
    };
  }

  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 60) {
    return {
      label: `Expires in ${minutes}m`,
      className: minutes < 30 ? "text-state-danger" : "text-state-warning",
      tone: (minutes < 30 ? "danger" : "warning") as "danger" | "warning"
    };
  }

  const hours = Math.ceil(minutes / 60);
  return {
    label: `Expires in ${hours}h`,
    className: hours < 2 ? "text-state-warning" : "text-ink-secondary",
    tone: (hours < 2 ? "warning" : "muted") as "warning" | "muted"
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
    () => getStatusMeta(approval.status),
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
        "relative overflow-hidden rounded-lg border border-line-subtle bg-bg-surface",
        "before:absolute before:inset-y-0 before:left-0 before:w-[2px]",
        statusMeta.accent
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-line-subtle bg-bg-surface-2",
              actionMeta.iconClass
            )}
          >
            <ActionIcon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
              {formatActionType(approval.actionType)}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {approval.business ? (
                <span className="inline-flex items-center rounded-md border border-line-subtle bg-bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-primary">
                  {approval.business.name}
                </span>
              ) : null}
              {revisionCount > 0 ? (
                <span className="inline-flex items-center rounded-md border border-steel/30 bg-steel/10 px-1.5 py-0.5 text-[10.5px] font-medium text-steel-bright">
                  Revised ×{revisionCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide",
            statusMeta.pill
          )}
        >
          <StatusDot tone={statusMeta.tone} />
          {statusMeta.label}
        </span>
      </div>

      <div className="space-y-4 px-4 py-4">
        {(approval.agent || approval.workflow) ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {approval.agent ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-app/60 px-2 py-0.5 text-[11.5px] text-ink-primary">
                <span aria-hidden>{approval.agent.emoji ?? "🤖"}</span>
                <span>{approval.agent.displayName}</span>
              </span>
            ) : null}
            {approval.workflow ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-app/60 px-2 py-0.5 text-[11.5px] text-ink-primary">
                <GitBranch className="h-3 w-3 text-steel-bright" />
                <span>{approval.workflow.name}</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Action details
          </div>
          {approval.actionType === "place_forex_order" ? (
            <ForexOrderCard detail={approval.actionDetail} />
          ) : (
            <JsonViewer
              data={approval.actionDetail ?? {}}
              collapsed
              collapsedLabel="Show details"
              expandedLabel="Hide details"
              maxHeight={240}
            />
          )}
        </div>

        {isPending ? (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 font-mono text-[11px] font-medium",
              expiryInfo.className
            )}
            title={new Date(approval.expiresAt).toLocaleString()}
          >
            <StatusDot tone={expiryInfo.tone} />
            {expiryInfo.label}
          </div>
        ) : reviewedAt ? (
          <div className="space-y-1 text-[12px] text-ink-secondary">
            <div>
              <span className="text-ink-muted">Reviewed by</span>{" "}
              <span className="text-ink-primary">
                {approval.reviewedBy ?? "Unknown"}
              </span>
              <span className="text-ink-muted">
                {" "}
                · {formatRelativeTime(reviewedAt)}
              </span>
            </div>
            {approval.reason ? (
              <div className="italic text-ink-muted">{approval.reason}</div>
            ) : null}
          </div>
        ) : null}

        {isPending ? (
          <div className="space-y-3 border-t border-line-subtle pt-4">
            {reviseOpen ? (
              <div className="space-y-3 rounded-md border border-steel/25 bg-steel/5 p-3">
                <div className="text-[12.5px] font-medium text-ink-primary">
                  Ask the agent to revise
                </div>
                <p className="text-[11.5px] leading-relaxed text-ink-secondary">
                  Tell the agent what to change. It rewrites the draft in place —
                  revise as many times as you want before approving.
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
                    size="sm"
                    onClick={() => void handleRevise()}
                    disabled={
                      loading ||
                      busyAction !== null ||
                      reviseInstructions.trim().length < 3
                    }
                  >
                    {busyAction === "revise" ? (
                      <>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Revising…
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                        Rewrite draft
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
              <div className="space-y-3 rounded-md border border-state-danger/25 bg-state-danger/5 p-3">
                <div className="text-[12.5px] font-medium text-ink-primary">
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
                    size="sm"
                    onClick={() => void handleReject()}
                    disabled={
                      loading ||
                      busyAction !== null ||
                      rejectReason.trim().length === 0
                    }
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    {busyAction === "reject" ? "Rejecting…" : "Confirm reject"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
                size="sm"
                className="bg-state-success text-white hover:brightness-110"
                onClick={() => void handleApprove()}
                disabled={loading || busyAction !== null}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {busyAction === "approve" ? "Approving…" : "Approve"}
              </Button>
              {canRevise ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-steel/40 text-steel-bright hover:bg-steel/10"
                  onClick={() => {
                    setReviseOpen((current) => !current);
                    if (rejectOpen) setRejectOpen(false);
                  }}
                  disabled={loading || busyAction !== null}
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  Revise
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-state-danger/30 text-state-danger hover:bg-state-danger/10"
                onClick={() => {
                  setRejectOpen((current) => !current);
                  if (reviseOpen) setReviseOpen(false);
                }}
                disabled={loading || busyAction !== null}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
