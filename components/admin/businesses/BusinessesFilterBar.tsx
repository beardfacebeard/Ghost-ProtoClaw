"use client";

import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type BusinessesFilterBarProps = {
  initialSearch?: string;
  currentStatus?: string;
  counts: {
    total: number;
    active: number;
    paused: number;
    planning: number;
    archived: number;
  };
};

const statusTabs = [
  { value: "all", label: "All", countKey: "total" },
  { value: "active", label: "Active", countKey: "active" },
  { value: "paused", label: "Paused", countKey: "paused" },
  { value: "planning", label: "Planning", countKey: "planning" },
  { value: "archived", label: "Archived", countKey: "archived" }
] as const;

export function BusinessesFilterBar({
  initialSearch = "",
  currentStatus = "all",
  counts
}: BusinessesFilterBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (search.trim()) {
        params.set("search", search.trim());
      } else {
        params.delete("search");
      }

      params.delete("page");

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [pathname, router, search, searchParams, startTransition]);

  function updateStatus(status: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }

    params.delete("page");

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-ghost-border bg-ghost-surface p-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search businesses by name or summary"
          className={cn("pl-9", isPending && "opacity-80")}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => {
          const active = currentStatus === tab.value;
          const count = counts[tab.countKey];

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => updateStatus(tab.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
                active
                  ? "border-brand-primary bg-ghost-nav-active text-brand-primary"
                  : "border-ghost-border bg-ghost-raised text-slate-400 hover:text-white"
              )}
            >
              <span>{tab.label}</span>
              <Badge
                className={cn(
                  "px-2 py-0 text-[11px]",
                  active
                    ? "bg-brand-primary text-white"
                    : "bg-ghost-surface text-slate-300"
                )}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
