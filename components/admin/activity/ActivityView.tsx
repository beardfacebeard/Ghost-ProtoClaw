"use client";

import { useState } from "react";
import { List, Share2 } from "lucide-react";

import { ActivityFeed } from "@/components/admin/activity/ActivityFeed";
import { ActivityNeural } from "@/components/admin/activity/ActivityNeural";
import type { PulseTopology } from "@/components/admin/activity/types";
import { cn } from "@/lib/utils";

type BusinessOption = { id: string; name: string };

type ActivityViewProps = {
  businesses: BusinessOption[];
  topology: PulseTopology;
};

type Tab = "feed" | "neural";

const TABS: Array<{ id: Tab; label: string; icon: typeof List }> = [
  { id: "feed", label: "Feed", icon: List },
  { id: "neural", label: "Neural Map", icon: Share2 }
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
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-ghost-raised text-white"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "feed" ? <ActivityFeed businesses={businesses} /> : null}
        {tab === "neural" ? <ActivityNeural topology={topology} /> : null}
      </div>
    </div>
  );
}
