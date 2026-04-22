"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Shield, ShieldCheck } from "lucide-react";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [phrase, setPhrase] = useState("");

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
      setConfirmOpen(false);
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
                      onOpenPaperConfirm={() => setConfirmOpen(true)}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {confirmOpen ? (
          <div className="space-y-3 rounded-md border border-state-warning/30 bg-state-warning/5 p-3">
            <div className="text-[13px] font-medium text-ink-primary">
              Upgrade to Paper mode
            </div>
            <p className="text-[12px] leading-relaxed text-ink-secondary">
              In Paper mode, your agents will route orders to connected broker
              demo accounts. No capital is at risk — but the desk starts
              behaving like a real trading operation: live quotes, real
              slippage modeling, real approval-queue flow. Pick this only when
              you&apos;re ready for that level of detail.
            </p>
            <div className="space-y-1.5">
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                Type &quot;{PAPER_UPGRADE_PHRASE}&quot; to confirm
              </label>
              <Input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder={PAPER_UPGRADE_PHRASE}
                disabled={working}
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void handleTransition("paper", phrase)}
                disabled={
                  working ||
                  phrase.trim().toUpperCase() !== PAPER_UPGRADE_PHRASE
                }
              >
                Upgrade to Paper
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setConfirmOpen(false);
                  setPhrase("");
                }}
                disabled={working}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        <div className="rounded-md border border-line-subtle bg-bg-app/30 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-secondary">
          <strong className="text-ink-primary">Phase 2a</strong> ships Research
          and Paper modes. Live-with-approval arrives in Phase 2b once the
          30-paper-trade track-record check, kill-switch verification, and
          typed risk acceptance are wired end-to-end. Downgrades are always
          instant. The Surveillance Agent will block any outbound agent
          response that contains profit guarantees or &quot;risk-free&quot;
          language — that rule is on in every tier.
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
  onOpenPaperConfirm
}: {
  currentMode: string;
  targetMode: string;
  working: boolean;
  onDowngrade: () => void;
  onOpenPaperConfirm: () => void;
}) {
  // Any transition to live_approval is hard-blocked in Phase 2a.
  if (targetMode === "live_approval") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        title="Live mode arrives in Phase 2b."
      >
        Phase 2b
      </Button>
    );
  }

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

  // Research → Paper: opens the typed-confirmation panel.
  if (currentMode === "research" && targetMode === "paper") {
    return (
      <Button size="sm" onClick={onOpenPaperConfirm} disabled={working}>
        Upgrade
      </Button>
    );
  }

  return null;
}
