"use client";

import { useState } from "react";
import { List, Radio, Share2 } from "lucide-react";

import { ActivityFeed } from "@/components/admin/activity/ActivityFeed";
import { ActivityRadar } from "@/components/admin/activity/ActivityRadar";
import type { PulseTopology } from "@/components/admin/activity/types";
import { cn } from "@/lib/utils";

type BusinessOption = { id: string; name: string };

type ActivityViewProps = {
  businesses: BusinessOption[];
  topology: PulseTopology;
};

type Tab = "feed" | "radar" | "neural";

const TABS: Array<{
  id: Tab;
  label: string;
  icon: typeof List;
  available: boolean;
  hint?: string;
}> = [
  { id: "feed", label: "Feed", icon: List, available: true },
  { id: "radar", label: "Radar", icon: Radio, available: true },
  {
    id: "neural",
    label: "Neural Map",
    icon: Share2,
    available: false,
    hint: "Force-directed agent graph — coming next"
  }
];

export function ActivityView({ businesses, topology }: ActivityViewProps) {
  const [tab, setTab] = useState<Tab>("feed");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-ghost-border bg-ghost-base px-5 py-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={!t.available}
              onClick={() => setTab(t.id)}
              title={t.hint}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-ghost-raised text-white"
                  : "text-slate-500 hover:text-slate-300",
                !t.available && "cursor-not-allowed opacity-40"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {!t.available ? (
                <span className="ml-1 rounded bg-ghost-surface px-1 text-[10px] text-slate-600">
                  soon
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "feed" ? <ActivityFeed businesses={businesses} /> : null}
        {tab === "radar" ? <ActivityRadar topology={topology} /> : null}
      </div>
    </div>
  );
}
