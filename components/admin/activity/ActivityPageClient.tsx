"use client";

import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { ActivityLogRow } from "@/components/admin/activity/ActivityLogRow";
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

type ActivityPageClientProps = {
  businesses: Array<{
    id: string;
    name: string;
  }>;
  businessLabels: Record<string, string>;
  isSuperAdmin: boolean;
  state: {
    tab: string;
    businessId: string;
    range: string;
    type: string;
    level: string;
    search: string;
    startDate: string;
    endDate: string;
    page: number;
  };
  totals: {
    activity: number;
    log: number;
    audit: number;
  };
  stats: {
    totalEvents: number;
    errorCount: number;
    warningCount: number;
  };
  entries: {
    activity: Array<{
      id: string;
      type: string;
      title: string;
      detail: string | null;
      status: string | null;
      metadata?: unknown;
      createdAt: Date | string;
      business?: {
        id: string;
        name: string;
      } | null;
    }>;
    log: Array<{
      id: string;
      level: string;
      message: string;
      action: string | null;
      metadata?: unknown;
      businessId?: string | null;
      createdAt: Date | string;
    }>;
    audit: Array<{
      id: string;
      actorEmail: string | null;
      eventType: string;
      entityType: string;
      entityId: string | null;
      beforeJson?: unknown;
      afterJson?: unknown;
      ipAddress: string | null;
      createdAt: Date | string;
    }>;
  };
};

const rangeOptions = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom" }
];

function setParams(
  current: URLSearchParams,
  values: Record<string, string | number>
) {
  const params = new URLSearchParams(current.toString());

  Object.entries(values).forEach(([key, value]) => {
    const normalized = String(value);
    if (
      !normalized ||
      normalized === "all" ||
      (key === "tab" && normalized === "activity") ||
      (key === "range" && normalized === "7d") ||
      (key === "page" && normalized === "1")
    ) {
      params.delete(key);
    } else {
      params.set(key, normalized);
    }
  });

  return params.toString();
}

function downloadCsv(filename: string, rows: string[][]) {
  const content = rows
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ActivityPageClient({
  businesses,
  businessLabels,
  isSuperAdmin,
  state,
  totals,
  stats,
  entries
}: ActivityPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(state.search);
  const currentEntries = useMemo(() => {
    if (state.tab === "log") {
      return entries.log;
    }

    if (state.tab === "audit") {
      return entries.audit;
    }

    return entries.activity;
  }, [entries.activity, entries.audit, entries.log, state.tab]);
  const currentTotal = useMemo(() => {
    if (state.tab === "log") {
      return totals.log;
    }

    if (state.tab === "audit") {
      return totals.audit;
    }

    return totals.activity;
  }, [state.tab, totals.activity, totals.audit, totals.log]);

  function updateFilters(values: Record<string, string | number>) {
    const query = setParams(searchParams, {
      ...values,
      page: values.page ?? 1
    });
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilters({ search: searchDraft });
  }

  function handleExport() {
    const rows =
      state.tab === "activity"
        ? [
            ["Timestamp", "Type", "Title", "Detail", "Business"],
            ...entries.activity.map((entry) => [
              String(entry.createdAt ?? ""),
              String(entry.type ?? ""),
              String(entry.title ?? ""),
              String(entry.detail ?? ""),
              String(
                (entry.business as { name?: string } | null | undefined)?.name ?? ""
              )
            ])
          ]
        : state.tab === "log"
          ? [
              ["Timestamp", "Level", "Message", "Action", "Business"],
              ...entries.log.map((entry) => [
                String(entry.createdAt ?? ""),
                String(entry.level ?? ""),
                String(entry.message ?? ""),
                String(entry.action ?? ""),
                String(
                  entry.businessId ? businessLabels[String(entry.businessId)] ?? "" : ""
                )
              ])
            ]
          : [
              ["Timestamp", "Actor", "Event", "Entity Type", "Entity ID"],
              ...entries.audit.map((entry) => [
                String(entry.createdAt ?? ""),
                String(entry.actorEmail ?? ""),
                String(entry.eventType ?? ""),
                String(entry.entityType ?? ""),
                String(entry.entityId ?? "")
              ])
            ];

    downloadCsv(`ghost-protoclaw-${state.tab}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={state.tab === "activity" ? "default" : "outline"}
          onClick={() => updateFilters({ tab: "activity" })}
        >
          Activity
        </Button>
        <Button
          type="button"
          variant={state.tab === "log" ? "default" : "outline"}
          onClick={() => updateFilters({ tab: "log" })}
        >
          System Logs
        </Button>
        {isSuperAdmin ? (
          <Button
            type="button"
            variant={state.tab === "audit" ? "default" : "outline"}
            onClick={() => updateFilters({ tab: "audit" })}
          >
            Audit Trail
          </Button>
        ) : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-ghost-border bg-ghost-surface p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="space-y-2">
            <div className="text-sm font-medium text-white">Business</div>
            <Select
              value={state.businessId}
              onValueChange={(value) => updateFilters({ businessId: value })}
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

          <form className="space-y-2" onSubmit={handleSearchSubmit}>
            <div className="text-sm font-medium text-white">Search</div>
            <div className="flex gap-2">
              <Input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search title, message, or actor"
              />
              <Button type="submit" variant="outline">
                Search
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <div className="text-sm font-medium text-white">Range</div>
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={state.range === option.value ? "default" : "outline"}
                  onClick={() => updateFilters({ range: option.value })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium text-white">
              {state.tab === "log" ? "Level" : "Type"}
            </div>
            {state.tab === "log" ? (
              <Select
                value={state.level}
                onValueChange={(value) => updateFilters({ level: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={state.type}
                onValueChange={(value) => updateFilters({ type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="approval">Approval</SelectItem>
                  <SelectItem value="backup">Backup</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {state.range === "custom" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-white">Start Date</div>
              <Input
                type="date"
                value={state.startDate}
                onChange={(event) => updateFilters({ startDate: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-white">End Date</div>
              <Input
                type="date"
                value={state.endDate}
                onChange={(event) => updateFilters({ endDate: event.target.value })}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ghost-border bg-ghost-surface p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Badge className="bg-ghost-black text-slate-300">
            Total events: {stats.totalEvents}
          </Badge>
          <Badge className="bg-status-error/15 text-status-error">
            Errors: {stats.errorCount}
          </Badge>
          <Badge className="bg-brand-amber/15 text-brand-amber">
            Warnings: {stats.warningCount}
          </Badge>
        </div>

        {isSuperAdmin ? (
          <Button type="button" variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export as CSV
          </Button>
        ) : null}
      </div>

      {currentEntries.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No activity found"
          description="Nothing matched the current filters for this timeline view."
        />
      ) : (
        <div className="space-y-3">
          {state.tab === "activity"
            ? entries.activity.map((entry) => (
                <ActivityLogRow
                  key={String(entry.id)}
                  entry={entry}
                  type="activity"
                  businessLabel={
                    (entry.business as { name?: string } | null | undefined)?.name ?? null
                  }
                />
              ))
            : state.tab === "log"
              ? entries.log.map((entry) => (
                  <ActivityLogRow
                    key={String(entry.id)}
                    entry={entry}
                    type="log"
                    businessLabel={
                      entry.businessId
                        ? businessLabels[String(entry.businessId)] ?? null
                        : null
                    }
                  />
                ))
              : entries.audit.map((entry) => (
                  <ActivityLogRow
                    key={String(entry.id)}
                    entry={entry}
                    type="audit"
                  />
                ))}
        </div>
      )}

      {currentTotal > currentEntries.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => updateFilters({ page: state.page + 1 })}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
