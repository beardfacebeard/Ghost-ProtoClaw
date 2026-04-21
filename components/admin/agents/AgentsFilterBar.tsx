"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutList, LayoutPanelTop, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type AgentsFilterBarProps = {
  initialSearch?: string;
  currentBusinessId?: string;
  currentType?: string;
  currentStatus?: string;
  currentView?: "grouped" | "list";
  businesses: Array<{
    id: string;
    name: string;
  }>;
};

const typeTabs = [
  { value: "all", label: "All" },
  { value: "main", label: "Main" },
  { value: "specialist", label: "Specialist" },
  { value: "global", label: "Global" }
] as const;

export function AgentsFilterBar({
  initialSearch = "",
  currentBusinessId = "all",
  currentType = "all",
  currentStatus = "active",
  currentView = "grouped",
  businesses
}: AgentsFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [, startTransition] = useTransition();

  const allBusinesses = useMemo(
    () => [{ id: "all", name: "All Businesses" }, ...businesses],
    [businesses]
  );

  const updateParams = useCallback((updater: (params: URLSearchParams) => void) => {
    startTransition(() => {
      const next = new URLSearchParams(searchParams.toString());
      updater(next);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const normalized = search.trim();
      const current = searchParams.get("search") ?? "";

      if (normalized === current) {
        return;
      }

      updateParams((params) => {
        if (normalized) {
          params.set("search", normalized);
        } else {
          params.delete("search");
        }
        params.delete("page");
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search, searchParams, updateParams]);

  return (
    <div className="space-y-4 rounded-2xl border border-line-subtle bg-bg-surface p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agents by name, role, or business..."
            className="pl-9"
          />
        </div>

        <Select
          value={currentBusinessId}
          onValueChange={(value) =>
            updateParams((params) => {
              if (value === "all") {
                params.delete("businessId");
              } else {
                params.set("businessId", value);
              }
              params.delete("page");
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by business" />
          </SelectTrigger>
          <SelectContent>
            {allBusinesses.map((business) => (
              <SelectItem key={business.id} value={business.id}>
                {business.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentStatus}
          onValueChange={(value) =>
            updateParams((params) => {
              if (value === "all") {
                params.delete("status");
              } else {
                params.set("status", value);
              }
              params.delete("page");
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {typeTabs.map((tab) => {
            const active = currentType === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() =>
                  updateParams((params) => {
                    if (tab.value === "all") {
                      params.delete("type");
                    } else {
                      params.set("type", tab.value);
                    }
                    params.delete("page");
                  })
                }
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                  active
                    ? "border-steel bg-steel/10 text-steel-bright"
                    : "border-line-subtle bg-bg-surface-2/30 text-ink-secondary hover:text-white"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center rounded-xl border border-line-subtle bg-bg-surface-2/40 p-1">
          <button
            type="button"
            onClick={() =>
              updateParams((params) => {
                params.set("view", "grouped");
              })
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              currentView === "grouped"
                ? "bg-ghost-nav-active text-steel-bright"
                : "text-ink-secondary hover:text-white"
            )}
          >
            <LayoutPanelTop className="h-4 w-4" />
            Grouped
          </button>
          <button
            type="button"
            onClick={() =>
              updateParams((params) => {
                params.set("view", "list");
              })
            }
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              currentView === "list"
                ? "bg-ghost-nav-active text-steel-bright"
                : "text-ink-secondary hover:text-white"
            )}
          >
            <LayoutList className="h-4 w-4" />
            List
          </button>
        </div>
      </div>

      {currentBusinessId !== "all" ? (
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>Scoped to:</span>
          <Badge className="bg-steel/15 text-steel-bright">
            {businesses.find((business) => business.id === currentBusinessId)?.name}
          </Badge>
        </div>
      ) : null}
    </div>
  );
}
