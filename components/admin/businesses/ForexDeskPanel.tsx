"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, Flame, Shield, ShieldCheck } from "lucide-react";

import {
  getJurisdictionLabel,
  getTradingModeDescription,
  getTradingModeLabel,
  tradingModeOptions
} from "@/components/admin/businesses/schema";
import { Panel, PanelBody, PanelHeader, StatusDot } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";

type ForexDeskPanelProps = {
  businessId: string;
  tradingMode: string | null;
  jurisdiction: string | null;
};

const PAPER_UPGRADE_PHRASE = "I UNDERSTAND PAPER MODE";
const LIVE_UPGRADE_PHRASE = "I ACCEPT LIVE TRADING RISK";

function toneForMode(mode: string): "success" | "warning" | "live" | "muted" {
  switch (mode) {
    case "research":
      return "success";
    case "paper":
      return "warning";
    case "live_approval":
      return "live";
    default:
      return "muted";
  }
}

/**
 * Dedicated Trading-mode + jurisdiction panel for Forex Research & Execution
 * Desk businesses. Renders on the Business detail overview.
 *
 * Phase 2a capabilities:
 * - Shows the current tradingMode and jurisdiction.
 * - Allows downgrade to research (instant, always safe).
 * - Allows upgrade from research → paper with a typed-phrase confirmation.
 * - Blocks live_approval with a clear "Phase 2b" message.
 *
 * Phase 2b will add the full consent chain for live_approval.
 */
export function ForexDeskPanel({
  businessId,
  tradingMode,
  jurisdiction
}: ForexDeskPanelProps) {
  const router = useRouter();
  const mode = tradingMode ?? "research";
  const [working, setWorking] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"paper" | "live_approval" | null>(null);
  const [phrase, setPhrase] = useState("");
  const [killOpen, setKillOpen] = useState(false);
  const [killing, setKilling] = useState(false);

  const upgradePhrase =
    confirmMode === "live_approval" ? LIVE_UPGRADE_PHRASE : PAPER_UPGRADE_PHRASE;

  async function fireKillSwitch() {
    setKilling(true);
    try {
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/kill-switch`,
        { method: "POST", body: JSON.stringify({}) }
      );
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        expiredApprovals?: number;
        cancelledEntries?: number;
        openPositionsNote?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Kill switch failed.");
        return;
      }
      toast.success(
        `${data.message ?? "Kill switch fired."} (${data.expiredApprovals ?? 0} approvals expired, ${data.cancelledEntries ?? 0} activity entries cancelled)`
      );
      setKillOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Kill switch failed."
      );
    } finally {
      setKilling(false);
    }
  }

  async function handleTransition(
    target: "research" | "paper" | "live_approval",
    acceptedDisclosure?: string
  ) {
    setWorking(true);
    try {
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/trading-mode`,
        {
          method: "POST",
          body: JSON.stringify({
            targetMode: target,
            acceptedDisclosure
          })
        }
      );
      const data = (await res.json()) as {
        business?: { tradingMode: string };
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Trading mode transition failed.");
        return;
      }
      toast.success(data.message || `Trading mode is now ${target}.`);
      setConfirmMode(null);
      setPhrase("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Trading mode transition failed."
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        label="Forex Desk — mode & jurisdiction"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-md border border-state-warning/30 bg-state-warning/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-state-warning">
            <Flame className="h-3 w-3" />
            Not financial advice
          </span>
        }
      />
      <PanelBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
              Jurisdiction
            </div>
            <div className="mt-1 text-[13.5px] font-semibold text-ink-primary">
              {getJurisdictionLabel(jurisdiction)}
            </div>
            {!jurisdiction ? (
              <div className="mt-1 text-[11.5px] leading-relaxed text-state-warning">
                Not declared. Declare before upgrading to Paper mode.
              </div>
            ) : null}
          </div>

          <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
              Trading mode
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <StatusDot tone={toneForMode(mode)} />
              <span className="text-[13.5px] font-semibold text-ink-primary">
                {getTradingModeLabel(mode)}
              </span>
            </div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">
              {getTradingModeDescription(mode)}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {tradingModeOptions.map((option) => {
            const isCurrent = option.value === mode;
            return (
              <div
                key={option.value}
                className={cn(
                  "rounded-md border px-3 py-2.5",
                  isCurrent
                    ? "border-steel/40 bg-steel/5"
                    : "border-line-subtle bg-bg-surface"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {option.value === "live_approval" ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-state-danger" />
                      ) : option.value === "paper" ? (
                        <Shield className="h-3.5 w-3.5 text-state-warning" />
                      ) : (
                        <Shield className="h-3.5 w-3.5 text-state-success" />
                      )}
                      <span className="text-[13px] font-medium text-ink-primary">
                        {option.label}
                      </span>
                      {isCurrent ? (
                        <span className="inline-flex items-center rounded-md border border-steel/30 bg-steel/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-steel-bright">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11.5px] leading-5 text-ink-secondary">
                      {option.description}
                    </p>
                  </div>
                  {!isCurrent ? (
                    <TierActionButton
                      currentMode={mode}
                      targetMode={option.value}
                      working={working}
                      onDowngrade={() => void handleTransition(option.value)}
                      onOpenPaperConfirm={() => setConfirmMode("paper")}
                      onOpenLiveConfirm={() => setConfirmMode("live_approval")}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {confirmMode ? (
          <div
            className={cn(
              "space-y-3 rounded-md border p-3",
              confirmMode === "live_approval"
                ? "border-state-danger/40 bg-state-danger/5"
                : "border-state-warning/30 bg-state-warning/5"
            )}
          >
            <div className="text-[13px] font-medium text-ink-primary">
              {confirmMode === "live_approval"
                ? "Upgrade to Live with per-trade approval"
                : "Upgrade to Paper mode"}
            </div>
            <p className="text-[12px] leading-relaxed text-ink-secondary">
              {confirmMode === "live_approval" ? (
                <>
                  In Live mode, every order your agents propose queues in the
                  Approvals inbox and fires only when YOU click Approve. The
                  agents never trade autonomously. Requires 30+ completed
                  paper trades before the server accepts the upgrade. Most
                  retail FX traders lose money — this template is a research
                  and ops system, not a profit machine. Type the phrase below
                  only if you genuinely accept that risk.
                </>
              ) : (
                <>
                  In Paper mode, your agents will route orders to connected
                  broker demo accounts. No capital is at risk — but the desk
                  starts behaving like a real trading operation: live quotes,
                  real slippage modeling, real approval-queue flow. Pick this
                  only when you&apos;re ready for that level of detail.
                </>
              )}
            </p>
            <div className="space-y-1.5">
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                Type &quot;{upgradePhrase}&quot; to confirm
              </label>
              <Input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder={upgradePhrase}
                disabled={working}
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void handleTransition(confirmMode, phrase)}
                disabled={
                  working ||
                  phrase.trim().toUpperCase() !== upgradePhrase
                }
                className={
                  confirmMode === "live_approval"
                    ? "bg-state-danger text-white hover:brightness-110"
                    : undefined
                }
              >
                {confirmMode === "live_approval"
                  ? "Upgrade to Live"
                  : "Upgrade to Paper"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setConfirmMode(null);
                  setPhrase("");
                }}
                disabled={working}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {mode !== "research" ? (
          <div className="space-y-2 rounded-md border border-state-danger/30 bg-state-danger/5 p-3">
            <div className="flex items-start gap-2">
              <AlertOctagon className="mt-0.5 h-4 w-4 flex-shrink-0 text-state-danger" />
              <div className="flex-1">
                <div className="text-[13px] font-medium text-ink-primary">
                  Emergency kill switch
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">
                  One click forces the desk back to Research mode, expires every
                  pending forex approval on this business, and cancels in-flight
                  forex activity entries. Existing OANDA positions are NOT
                  auto-flattened in Phase 2b — close them manually in your
                  broker if you need the account flat. Use this when something
                  looks wrong and you want to stop the bleeding fast.
                </p>
              </div>
            </div>
            {killOpen ? (
              <div className="space-y-2 rounded-md border border-state-danger/40 bg-state-danger/10 p-2.5">
                <div className="text-[12px] font-medium text-ink-primary">
                  Fire the kill switch?
                </div>
                <p className="text-[11.5px] leading-relaxed text-ink-secondary">
                  This cannot be undone at the approval / activity level — any
                  cancelled order record stays cancelled. You can still place
                  new orders after downgrading by re-upgrading through the
                  normal tier flow.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void fireKillSwitch()}
                    disabled={killing}
                  >
                    <AlertOctagon className="mr-1.5 h-3.5 w-3.5" />
                    {killing ? "Firing…" : "FIRE"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setKillOpen(false)}
                    disabled={killing}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setKillOpen(true)}
              >
                <AlertOctagon className="mr-1.5 h-3.5 w-3.5" />
                Arm kill switch
              </Button>
            )}
          </div>
        ) : null}

        <div className="rounded-md border border-line-subtle bg-bg-app/30 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-secondary">
          All three tiers are live. The Live-with-approval tier requires 30+
          completed paper trades before upgrade is accepted and a typed
          confirmation phrase; every live order queues in Approvals and fires
          only on explicit human click. Downgrades are always instant and
          cancel open live orders. The Surveillance Agent blocks any outbound
          agent response containing profit guarantees or &quot;risk-free&quot;
          language across every tier.
        </div>
      </PanelBody>
    </Panel>
  );
}

function TierActionButton({
  currentMode,
  targetMode,
  working,
  onDowngrade,
  onOpenPaperConfirm,
  onOpenLiveConfirm
}: {
  currentMode: string;
  targetMode: string;
  working: boolean;
  onDowngrade: () => void;
  onOpenPaperConfirm: () => void;
  onOpenLiveConfirm: () => void;
}) {
  const isDowngrade =
    (currentMode === "live_approval" &&
      (targetMode === "paper" || targetMode === "research")) ||
    (currentMode === "paper" && targetMode === "research");

  if (isDowngrade) {
    return (
      <Button size="sm" variant="outline" onClick={onDowngrade} disabled={working}>
        Downgrade
      </Button>
    );
  }

  if (currentMode === "research" && targetMode === "paper") {
    return (
      <Button size="sm" onClick={onOpenPaperConfirm} disabled={working}>
        Upgrade
      </Button>
    );
  }

  if (currentMode === "paper" && targetMode === "live_approval") {
    return (
      <Button
        size="sm"
        onClick={onOpenLiveConfirm}
        disabled={working}
        className="bg-state-danger text-white hover:brightness-110"
      >
        Upgrade to Live
      </Button>
    );
  }

  // Research → Live is not a direct path. User must go through Paper first.
  if (currentMode === "research" && targetMode === "live_approval") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        title="Move through Paper mode first — 30+ paper trades required before Live unlocks."
      >
        Paper first
      </Button>
    );
  }

  return null;
}
