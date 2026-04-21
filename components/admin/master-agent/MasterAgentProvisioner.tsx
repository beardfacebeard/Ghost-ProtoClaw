"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radar, Sparkles } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * Shown when no master agent exists for the organization yet. Invites
 * the user to provision one. Matches the 2026 redesign's premium empty-
 * state treatment — steel-haloed icon tile, display-font title, compact
 * explainer, and a single decisive CTA.
 */
export function MasterAgentProvisioner() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    try {
      setCreating(true);
      const res = await fetchWithCsrf("/api/admin/master-agent", {
        method: "POST"
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || "Failed to create master agent.");
        return;
      }
      toast.success("Master agent created.");
      router.refresh();
    } catch {
      toast.error("Failed to create master agent.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="flex max-w-xl flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-steel/20 bg-bg-surface shadow-[0_0_40px_rgba(91,127,176,0.15)]">
          <Radar className="h-7 w-7 text-steel-bright" strokeWidth={1.5} />
        </div>
        <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
          Work · Master Agent
        </div>
        <h2 className="mb-3 font-display text-[26px] font-semibold leading-tight tracking-tight text-ink-primary">
          Your point of contact across every business.
        </h2>
        <p className="mb-6 max-w-lg text-[13px] leading-relaxed text-ink-secondary">
          The master agent is one layer above your business CEOs — it
          talks to them on your behalf, pulls status across businesses,
          and relays answers. It doesn&apos;t execute actions directly;
          that stays with your per-business agents. Think of it as your
          chief of staff.
        </p>
        <Button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
        >
          {creating ? (
            <Loader2
              className="mr-2 h-3.5 w-3.5 animate-spin"
              strokeWidth={1.5}
            />
          ) : (
            <Sparkles
              className="mr-2 h-3.5 w-3.5"
              strokeWidth={1.5}
            />
          )}
          {creating ? "Creating…" : "Create Master Agent"}
        </Button>
      </div>
    </div>
  );
}
