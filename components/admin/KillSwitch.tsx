"use client";

/**
 * Global kill switch — the red button in the TopBar and the paused banner.
 *
 * Exports two surfaces that share a single polling hook so both stay in
 * sync without duplicating fetches:
 *
 *   <KillSwitchTrigger session={...} />  - the pause pill, lives in TopBar
 *   <KillSwitchBanner session={...} />   - the red banner under TopBar
 *
 * Owner-only for org-wide actions. Admins see the banner but can't unpause
 * it (the per-business pause endpoint is their path).
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Loader2, Pause, Play, ShieldAlert } from "lucide-react";

import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { AdminSession } from "@/components/admin/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

type PauseState = {
  globalPaused: boolean;
  pausedAt: string | null;
  pausedBy: string | null;
  pausedReason: string | null;
};

const POLL_INTERVAL_MS = 30_000;

// ── Shared poll hook ─────────────────────────────────────────────────

type KillSwitchContextValue = {
  pause: PauseState | null;
  busy: boolean;
  pauseOrg: (reason: string) => Promise<void>;
  unpauseOrg: () => Promise<void>;
};

const KillSwitchContext = createContext<KillSwitchContextValue | null>(null);

export function KillSwitchProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [pause, setPause] = useState<PauseState | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchPause = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pause-all", {
        method: "GET",
        credentials: "same-origin",
        // Avoid HTTP caching — operator pause/unpause must show up on every
        // open tab within one poll interval. The route is force-dynamic
        // server-side too.
        cache: "no-store"
      });
      if (!res.ok) return;
      const data = (await res.json()) as { pause: PauseState | null };
      setPause(data.pause);
    } catch {
      /* Best-effort. */
    }
  }, []);

  useEffect(() => {
    void fetchPause();
    const id = setInterval(() => void fetchPause(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPause]);

  const pauseOrg = useCallback(async (reason: string) => {
    setBusy(true);
    try {
      const res = await fetchWithCsrf("/api/admin/pause-all", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined })
      });
      if (res.ok) {
        const data = (await res.json()) as { pause: PauseState };
        setPause(data.pause);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const unpauseOrg = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetchWithCsrf("/api/admin/pause-all", {
        method: "DELETE"
      });
      if (res.ok) {
        const data = (await res.json()) as { pause: PauseState };
        setPause(data.pause);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <KillSwitchContext.Provider value={{ pause, busy, pauseOrg, unpauseOrg }}>
      {children}
    </KillSwitchContext.Provider>
  );
}

function useKillSwitch() {
  const ctx = useContext(KillSwitchContext);
  if (!ctx) {
    throw new Error("KillSwitch surfaces must be rendered inside KillSwitchProvider.");
  }
  return ctx;
}

// ── Pill trigger — TopBar ────────────────────────────────────────────

export function KillSwitchTrigger({ session }: { session: AdminSession }) {
  const { pause, busy, pauseOrg } = useKillSwitch();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const isOwner = session.role === "super_admin";
  if (!isOwner || pause?.globalPaused) return null;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="hidden text-[12px] text-ink-muted hover:bg-state-danger/10 hover:text-state-danger md:inline-flex"
        aria-label="Pause all agents"
      >
        <Pause className="mr-1.5 h-3.5 w-3.5" />
        Pause all
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setReason("");
        }}
        title="Pause all agents and workflows?"
        description="Every agent run, scheduled workflow, delegation, and master-agent call will short-circuit until you unpause. In-flight LLM calls finish; new ones are blocked."
        confirmLabel="Pause everything"
        cancelLabel="Cancel"
        variant="danger"
        confirmText="PAUSE"
        loading={busy}
        onConfirm={() => pauseOrg(reason)}
      >
        <div className="space-y-1 py-2">
          <label
            htmlFor="kill-switch-reason"
            className="text-xs text-ink-secondary"
          >
            Reason (optional — surfaced in the banner)
          </label>
          <Input
            id="kill-switch-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. investigating runaway email sends"
            maxLength={500}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}

// ── Sticky red banner ────────────────────────────────────────────────

export function KillSwitchBanner({ session }: { session: AdminSession }) {
  const { pause, busy, unpauseOrg } = useKillSwitch();
  const isOwner = session.role === "super_admin";
  if (!pause?.globalPaused) return null;

  return (
    <div
      role="status"
      className="flex w-full items-center gap-3 border-b border-state-danger/40 bg-state-danger/10 px-4 py-2 text-[12px] text-state-danger md:px-6"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">All agents paused.</span>{" "}
        <span className="text-state-danger/80">
          {pause.pausedBy ? `by ${pause.pausedBy}` : ""}
          {pause.pausedAt
            ? ` at ${new Date(pause.pausedAt).toLocaleString()}`
            : ""}
          {pause.pausedReason ? ` — ${pause.pausedReason}` : ""}
        </span>
      </div>
      {isOwner ? (
        <Button
          size="sm"
          variant="outline"
          onClick={unpauseOrg}
          disabled={busy}
          className="shrink-0 border-state-danger/60 text-state-danger hover:bg-state-danger/10"
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-3.5 w-3.5" />
          )}
          Unpause
        </Button>
      ) : (
        <span className="shrink-0 text-[11px] text-state-danger/70">
          Owner must unpause
        </span>
      )}
    </div>
  );
}
