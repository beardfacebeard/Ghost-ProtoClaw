"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ApprovalCard } from "@/components/admin/approvals/ApprovalCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type ApprovalRecord = {
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

type ApprovalsPageClientProps = {
  approvals: ApprovalRecord[];
  total: number;
  pendingCount: number;
  isSuperAdmin: boolean;
  filters: {
    status: string;
    businessId: string;
    workflowId: string;
    agentId: string;
    startDate: string;
    endDate: string;
  };
  businesses: Array<{
    id: string;
    name: string;
  }>;
  workflows: Array<{
    id: string;
    name: string;
    businessId: string;
  }>;
  agents: Array<{
    id: string;
    displayName: string;
    emoji: string | null;
    businessId: string | null;
  }>;
};

const statusTabs = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "all", label: "All" }
];

function updateQueryParams(
  current: URLSearchParams,
  nextValues: Record<string, string>
) {
  const params = new URLSearchParams(current.toString());

  Object.entries(nextValues).forEach(([key, value]) => {
    if (!value || value === "all" || (key === "status" && value === "pending")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });

  return params.toString();
}

function getEmptyStateCopy(status: string) {
  if (status === "pending") {
    return "No pending approvals. Your agents are running smoothly.";
  }

  return `No ${status === "all" ? "" : status} approvals in this period.`.trim();
}

export function ApprovalsPageClient({
  approvals,
  total,
  pendingCount,
  isSuperAdmin,
  filters,
  businesses,
  workflows,
  agents
}: ApprovalsPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localApprovals, setLocalApprovals] = useState(approvals);
  const [bulkApproveOpen, setBulkApproveOpen] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLocalApprovals(approvals);
  }, [approvals]);

  const filteredWorkflows = useMemo(
    () =>
      filters.businessId === "all"
        ? workflows
        : workflows.filter((workflow) => workflow.businessId === filters.businessId),
    [filters.businessId, workflows]
  );
  const filteredAgents = useMemo(
    () =>
      filters.businessId === "all"
        ? agents
        : agents.filter(
            (agent) => agent.businessId === filters.businessId || agent.businessId === null
          ),
    [agents, filters.businessId]
  );
  const urgentApprovals = useMemo(
    () =>
      localApprovals.filter((approval) => {
        if (approval.status !== "pending") {
          return false;
        }

        const expiresAt = new Date(approval.expiresAt);
        const diffMs = expiresAt.getTime() - Date.now();
        return diffMs > 0 && diffMs <= 60 * 60 * 1000;
      }),
    [localApprovals]
  );

  function setFilter(values: Record<string, string>) {
    const query = updateQueryParams(searchParams, values);
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }

  async function handleApprove(approval: ApprovalRecord) {
    const previous = localApprovals;
    const reviewedAt = new Date().toISOString();

    setLocalApprovals((current) =>
      current.map((entry) =>
        entry.id === approval.id
          ? {
              ...entry,
              status: "approved",
              reviewedBy: "You",
              reviewedAt
            }
          : entry
      )
    );

    try {
      const response = await fetchWithCsrf(`/api/admin/approvals/${approval.id}/approve`, {
        method: "POST",
        body: JSON.stringify({})
      });
      const result = (await response.json()) as {
        error?: string;
        approval?: {
          status: string;
          reviewedBy: string | null;
          reviewedAt: string | null;
          reason: string | null;
        };
      };

      if (!response.ok || !result.approval) {
        throw new Error(result.error ?? "Unable to approve request.");
      }

      setLocalApprovals((current) =>
        current.map((entry) =>
          entry.id === approval.id
            ? {
                ...entry,
                status: result.approval?.status ?? "approved",
                reviewedBy: result.approval?.reviewedBy ?? entry.reviewedBy,
                reviewedAt: result.approval?.reviewedAt ?? entry.reviewedAt,
                reason: result.approval?.reason ?? entry.reason
              }
            : entry
        )
      );
      toast.success("Approval granted.");
      startTransition(() => router.refresh());
    } catch (error) {
      setLocalApprovals(previous);
      toast.error(error instanceof Error ? error.message : "Unable to approve request.");
      throw error;
    }
  }

  async function handleReject(approval: ApprovalRecord, reason: string) {
    const previous = localApprovals;
    const reviewedAt = new Date().toISOString();

    setLocalApprovals((current) =>
      current.map((entry) =>
        entry.id === approval.id
          ? {
              ...entry,
              status: "rejected",
              reviewedBy: "You",
              reviewedAt,
              reason
            }
          : entry
      )
    );

    try {
      const response = await fetchWithCsrf(`/api/admin/approvals/${approval.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason })
      });
      const result = (await response.json()) as {
        error?: string;
        approval?: {
          status: string;
          reviewedBy: string | null;
          reviewedAt: string | null;
          reason: string | null;
        };
      };

      if (!response.ok || !result.approval) {
        throw new Error(result.error ?? "Unable to reject request.");
      }

      setLocalApprovals((current) =>
        current.map((entry) =>
          entry.id === approval.id
            ? {
                ...entry,
                status: result.approval?.status ?? "rejected",
                reviewedBy: result.approval?.reviewedBy ?? entry.reviewedBy,
                reviewedAt: result.approval?.reviewedAt ?? entry.reviewedAt,
                reason: result.approval?.reason ?? reason
              }
            : entry
        )
      );
      toast.success("Approval rejected.");
      startTransition(() => router.refresh());
    } catch (error) {
      setLocalApprovals(previous);
      toast.error(error instanceof Error ? error.message : "Unable to reject request.");
      throw error;
    }
  }

  async function handleRevise(approval: ApprovalRecord, instructions: string) {
    const previous = localApprovals;
    try {
      const response = await fetchWithCsrf(
        `/api/admin/approvals/${approval.id}/revise`,
        {
          method: "POST",
          body: JSON.stringify({ instructions })
        }
      );
      const result = (await response.json()) as {
        error?: string;
        approval?: { id: string; actionDetail: unknown };
      };
      if (!response.ok || !result.approval) {
        throw new Error(result.error ?? "Unable to revise draft.");
      }
      setLocalApprovals((current) =>
        current.map((entry) =>
          entry.id === approval.id
            ? { ...entry, actionDetail: result.approval!.actionDetail }
            : entry
        )
      );
      toast.success("Draft revised. Review and approve when ready.");
      startTransition(() => router.refresh());
    } catch (error) {
      setLocalApprovals(previous);
      const message =
        error instanceof Error ? error.message : "Unable to revise draft.";
      toast.error(message);
      throw error;
    }
  }

  async function handleApproveAll() {
    const pendingApprovals = localApprovals.filter(
      (approval) => approval.status === "pending"
    );

    if (pendingApprovals.length === 0) {
      setBulkApproveOpen(false);
      return;
    }

    try {
      setBulkApproving(true);

      for (const approval of pendingApprovals) {
        const response = await fetchWithCsrf(
          `/api/admin/approvals/${approval.id}/approve`,
          {
            method: "POST",
            body: JSON.stringify({})
          }
        );

        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error ?? "Unable to approve all requests.");
        }
      }

      setBulkApproveOpen(false);
      toast.success(`${pendingApprovals.length} approvals granted.`);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to approve all requests.");
    } finally {
      setBulkApproving(false);
    }
  }

  return (
    <div className="space-y-6">
      {urgentApprovals.length > 0 ? (
        <div className="rounded-2xl border border-state-warning/30 bg-state-warning/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-state-warning" />
              <div className="space-y-1">
                <div className="font-semibold text-white">
                  {urgentApprovals.length} approval(s) expire soon
                </div>
                <div className="text-sm text-ink-primary">
                  Action is required in the next hour.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {urgentApprovals.map((approval) => (
                <a
                  key={approval.id}
                  href={`#approval-${approval.id}`}
                  className="rounded-full border border-state-warning/25 bg-bg-app px-3 py-1 text-sm text-state-warning"
                >
                  {approval.business?.name ?? approval.actionType.replaceAll("_", " ")}
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <Button
            key={tab.value}
            type="button"
            variant={filters.status === tab.value ? "default" : "outline"}
            className={
              tab.value === "pending" && pendingCount > 0
                ? filters.status === tab.value
                  ? "bg-state-warning text-bg-app hover:brightness-110"
                  : "border-state-warning/40 text-state-warning hover:bg-state-warning/10"
                : undefined
            }
            onClick={() => setFilter({ status: tab.value })}
          >
            {tab.label}
            {tab.value === "pending" ? ` (${pendingCount})` : ""}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 rounded-2xl border border-line-subtle bg-bg-surface p-4 lg:grid-cols-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-white">Business</div>
          <Select
            value={filters.businessId}
            onValueChange={(value) =>
              setFilter({ businessId: value, workflowId: "all", agentId: "all" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Businesses</SelectItem>
              {businesses.map((business) => (
                <SelectItem key={business.id} value={business.id}>
                  {business.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-white">Workflow</div>
          <Select
            value={filters.workflowId}
            onValueChange={(value) => setFilter({ workflowId: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Workflows</SelectItem>
              {filteredWorkflows.map((workflow) => (
                <SelectItem key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-white">Agent</div>
          <Select
            value={filters.agentId}
            onValueChange={(value) => setFilter({ agentId: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {filteredAgents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.emoji ? `${agent.emoji} ` : ""}
                  {agent.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium text-white">From</div>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilter({ startDate: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-white">To</div>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilter({ endDate: event.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-ink-secondary">
          Showing {localApprovals.length} of {total} approval request(s)
        </div>

        {isSuperAdmin &&
        filters.status === "pending" &&
        localApprovals.filter((approval) => approval.status === "pending").length > 1 ? (
          <div className="flex items-center gap-2">
            <Badge className="bg-state-warning/15 text-state-warning">
              Human review queue
            </Badge>
            <Button
              type="button"
              variant="outline"
              className="border-state-warning/35 text-state-warning hover:bg-state-warning/10"
              onClick={() => setBulkApproveOpen(true)}
            >
              Approve All
            </Button>
          </div>
        ) : null}
      </div>

      {localApprovals.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="No approvals found"
          description={getEmptyStateCopy(filters.status)}
        />
      ) : (
        <div className="space-y-4">
          {localApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={handleApprove}
              onReject={handleReject}
              onRevise={handleRevise}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={bulkApproveOpen}
        onOpenChange={setBulkApproveOpen}
        title="Approve all pending requests?"
        description="This will approve every currently visible pending request in one batch."
        confirmLabel="Approve All"
        onConfirm={handleApproveAll}
        loading={bulkApproving}
      />
    </div>
  );
}
