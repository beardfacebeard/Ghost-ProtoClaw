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
    // flex-1 + min-w-0 here are load-bearing: /admin/pulse wraps this in a
    // flex-row viewport-bound container. Without flex-1 we'd shrink to
    // content width, which is exactly what caused the Feed's details panel
    // and the Neural Map's canvas to collapse to tiny in prior deploys.
    <div className="flex h-full min-w-0 flex-1 flex-col">
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
