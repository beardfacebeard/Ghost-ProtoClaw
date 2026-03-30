"use client";

import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

const triggerTabs = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manual" },
  { value: "scheduled", label: "Scheduled" },
  { value: "webhook", label: "Webhook" },
  { value: "new_email", label: "Email" },
  { value: "new_lead", label: "Lead" },
  { value: "new_comment", label: "Comment" }
] as const;

type WorkflowsFilterBarProps = {
  initialSearch?: string;
  currentBusinessId?: string;
  currentTrigger?: string;
  currentStatus?: string;
  businesses: Array<{
    id: string;
    name: string;
  }>;
};

export function WorkflowsFilterBar({
  initialSearch = "",
  currentBusinessId = "all",
  currentTrigger = "all",
  currentStatus = "active",
  businesses
}: WorkflowsFilterBarProps) {
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

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [pathname, router, search, searchParams, startTransition]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all" || (key === "status" && value === "active")) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-ghost-border bg-ghost-surface p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_160px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search workflows by name, business, or description"
            className={cn("pl-9", isPending && "opacity-80")}
          />
        </div>

        <Select
          value={currentBusinessId}
          onValueChange={(value) => updateParam("businessId", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All businesses" />
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

        <Select
          value={currentStatus}
          onValueChange={(value) => updateParam("status", value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {triggerTabs.map((tab) => {
          const active = currentTrigger === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => updateParam("trigger", tab.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
                active
                  ? "border-brand-primary bg-ghost-nav-active text-brand-primary"
                  : "border-ghost-border bg-ghost-raised text-slate-400 hover:text-white"
              )}
            >
              <span>{tab.label}</span>
              {active ? (
                <Badge className="bg-brand-primary px-2 py-0 text-[11px] text-white">
                  Active
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
