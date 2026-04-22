"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  FileWarning,
  Gavel,
  Plus,
  Scale,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import {
  dealModeOptions,
  getDealModeDescription,
  getDealModeLabel,
  usStateOptions,
} from "@/components/admin/businesses/schema";
import {
  Panel,
  PanelBody,
  PanelHeader,
  StatusDot,
} from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";

type DealMode = "research" | "outreach" | "contract";

type AttorneyProfile = {
  id: string;
  state: string;
  name: string;
  firmName: string | null;
  email: string;
  phone: string | null;
  barNumber: string | null;
  licenseVerifiedAt: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type DealhawkDeskPanelProps = {
  businessId: string;
  dealMode: DealMode;
  tcpaAttestedAt: string | null;
  tcpaAttestedBy: string | null;
};

const OUTREACH_UPGRADE_PHRASE = "I ATTEST TCPA COMPLIANCE";
const CONTRACT_UPGRADE_PHRASE = "I CONFIRM ATTORNEY ON FILE";

function toneForMode(mode: DealMode): "success" | "warning" | "live" | "muted" {
  switch (mode) {
    case "research":
      return "success";
    case "outreach":
      return "warning";
    case "contract":
      return "live";
    default:
      return "muted";
  }
}

export function DealhawkDeskPanel({
  businessId,
  dealMode,
  tcpaAttestedAt,
  tcpaAttestedBy,
}: DealhawkDeskPanelProps) {
  const router = useRouter();
  const mode = dealMode;

  const [working, setWorking] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<"outreach" | "contract" | null>(
    null
  );
  const [phrase, setPhrase] = useState("");

  const [attorneys, setAttorneys] = useState<AttorneyProfile[]>([]);
  const [attorneysLoading, setAttorneysLoading] = useState(true);
  const [addingAttorney, setAddingAttorney] = useState(false);
  const [newAttorney, setNewAttorney] = useState<{
    state: string;
    name: string;
    firmName: string;
    email: string;
    phone: string;
    barNumber: string;
    notes: string;
  }>({
    state: "",
    name: "",
    firmName: "",
    email: "",
    phone: "",
    barNumber: "",
    notes: "",
  });

  useEffect(() => {
    void refreshAttorneys();
  }, [businessId]);

  async function refreshAttorneys() {
    setAttorneysLoading(true);
    try {
      const res = await fetch(
        `/api/admin/businesses/${businessId}/attorneys?includeArchived=false`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error || "Failed to load attorneys.");
        return;
      }
      const data = (await res.json()) as { attorneys: AttorneyProfile[] };
      setAttorneys(data.attorneys);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load attorneys."
      );
    } finally {
      setAttorneysLoading(false);
    }
  }

  async function handleTransition(
    target: DealMode,
    acceptedDisclosure?: string
  ) {
    setWorking(true);
    try {
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/deal-mode`,
        {
          method: "POST",
          body: JSON.stringify({ targetMode: target, acceptedDisclosure }),
        }
      );
      const data = (await res.json()) as {
        business?: { dealMode: string };
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Deal mode transition failed.");
        return;
      }
      toast.success(data.message || `Deal mode is now ${target}.`);
      setConfirmTarget(null);
      setPhrase("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Deal mode transition failed."
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleAddAttorney() {
    if (!newAttorney.state || !newAttorney.name || !newAttorney.email) {
      toast.error("State, name, and email are required.");
      return;
    }
    setAddingAttorney(true);
    try {
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/attorneys`,
        {
          method: "POST",
          body: JSON.stringify({
            state: newAttorney.state,
            name: newAttorney.name,
            firmName: newAttorney.firmName || null,
            email: newAttorney.email,
            phone: newAttorney.phone || null,
            barNumber: newAttorney.barNumber || null,
            notes: newAttorney.notes || null,
          }),
        }
      );
      const data = (await res.json()) as {
        attorney?: AttorneyProfile;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Failed to add attorney.");
        return;
      }
      toast.success(data.message || "Attorney added.");
      setNewAttorney({
        state: "",
        name: "",
        firmName: "",
        email: "",
        phone: "",
        barNumber: "",
        notes: "",
      });
      await refreshAttorneys();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add attorney."
      );
    } finally {
      setAddingAttorney(false);
    }
  }

  async function handleArchiveAttorney(attorneyId: string, name: string) {
    if (
      !window.confirm(
        `Archive ${name}? The profile is preserved for audit but is no longer active. You can add a new attorney for the same state afterward.`
      )
    ) {
      return;
    }
    try {
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/attorneys/${attorneyId}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Failed to archive attorney.");
        return;
      }
      toast.success(data.message || "Attorney archived.");
      await refreshAttorneys();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to archive attorney."
      );
    }
  }

  const coveredStates = Array.from(
    new Set(attorneys.filter((a) => a.isActive).map((a) => a.state))
  ).sort();

  const expectedPhrase =
    confirmTarget === "contract"
      ? CONTRACT_UPGRADE_PHRASE
      : OUTREACH_UPGRADE_PHRASE;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          label="Dealhawk Desk — mode & legal firewall"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-md border border-state-warning/30 bg-state-warning/10 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-state-warning">
              <FileWarning className="h-3 w-3" />
              Not legal or financial advice
            </span>
          }
        />
        <PanelBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                Current deal mode
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <StatusDot tone={toneForMode(mode)} />
                <span className="text-[13.5px] font-semibold text-ink-primary">
                  {getDealModeLabel(mode)}
                </span>
              </div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">
                {getDealModeDescription(mode)}
              </div>
            </div>
            <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                TCPA attestation
              </div>
              <div className="mt-1 text-[13.5px] font-semibold text-ink-primary">
                {tcpaAttestedAt ? "On file" : "Not yet attested"}
              </div>
              <div className="mt-1 text-[11.5px] leading-relaxed text-ink-secondary">
                {tcpaAttestedAt ? (
                  <>
                    Attested {new Date(tcpaAttestedAt).toLocaleDateString()} by{" "}
                    <span className="font-mono text-ink-primary">
                      {tcpaAttestedBy ?? "unknown"}
                    </span>
                    .
                  </>
                ) : (
                  "Required before Outreach mode unlocks. Attests you will honor DNC, opt-outs, and state disclosures on every touch."
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {dealModeOptions.map((option) => {
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
                        {option.value === "contract" ? (
                          <Gavel className="h-3.5 w-3.5 text-state-danger" />
                        ) : option.value === "outreach" ? (
                          <ShieldAlert className="h-3.5 w-3.5 text-state-warning" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5 text-state-success" />
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
                      <DealTierActionButton
                        currentMode={mode}
                        targetMode={option.value as DealMode}
                        working={working}
                        hasActiveAttorneys={attorneys.length > 0}
                        onDowngrade={() => void handleTransition(option.value as DealMode)}
                        onOpenOutreachConfirm={() => {
                          setConfirmTarget("outreach");
                          setPhrase("");
                        }}
                        onOpenContractConfirm={() => {
                          setConfirmTarget("contract");
                          setPhrase("");
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {confirmTarget ? (
            <div
              className={cn(
                "space-y-3 rounded-md border p-3",
                confirmTarget === "contract"
                  ? "border-state-danger/40 bg-state-danger/5"
                  : "border-state-warning/30 bg-state-warning/5"
              )}
            >
              <div className="text-[13px] font-medium text-ink-primary">
                {confirmTarget === "contract"
                  ? "Upgrade to Contract mode"
                  : "Upgrade to Outreach mode"}
              </div>
              <p className="text-[12px] leading-relaxed text-ink-secondary">
                {confirmTarget === "contract" ? (
                  <>
                    In Contract mode, the desk may draft binding purchase
                    agreements, assignments, Sub-To packages, LOIs, and
                    disposition blasts — but ONLY for properties in states
                    where you have an active attorney on file (see the
                    Attorney-on-File roster below). Every binding output is
                    re-gated per deal. Confirm you have reviewed your attorney
                    roster and understand this condition.
                  </>
                ) : (
                  <>
                    In Outreach mode, the desk may generate and send TCPA-
                    compliant SMS, letters, and cold-call scripts. You attest
                    that every touch will (a) check the national DNC list,
                    (b) include a valid opt-out mechanism, (c) honor opt-outs
                    instantly, (d) include state-specific wholesaler
                    disclosures where required, and (e) avoid explicit
                    reference to pre-foreclosure / probate / divorce filings
                    in the outreach itself. This attestation is logged with
                    your identity and timestamp.
                  </>
                )}
              </p>
              <div className="space-y-1.5">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                  Type &quot;{expectedPhrase}&quot; to confirm
                </label>
                <Input
                  value={phrase}
                  onChange={(event) => setPhrase(event.target.value)}
                  placeholder={expectedPhrase}
                  disabled={working}
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleTransition(confirmTarget, phrase)}
                  disabled={
                    working ||
                    phrase.trim().toUpperCase() !== expectedPhrase
                  }
                  className={
                    confirmTarget === "contract"
                      ? "bg-state-danger text-white hover:brightness-110"
                      : undefined
                  }
                >
                  {confirmTarget === "contract"
                    ? "Upgrade to Contract"
                    : "Upgrade to Outreach"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConfirmTarget(null);
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
            Tiers are irreversible in direction only — downgrades are always
            instant, and revoke outreach / contract authority immediately. The
            Disposition Agent blocks any output that markets the underlying
            property (vs. the equitable interest in the contract) across every
            tier. Every Sub-To output carries the Garn-St. Germain (12 U.S.C. §
            1701j-3) DOS disclaimer. This panel is not legal advice.
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          label="Attorney-on-File Roster"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-app/50 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-secondary">
              <Scale className="h-3 w-3" />
              {coveredStates.length} state
              {coveredStates.length === 1 ? "" : "s"} covered
            </span>
          }
        />
        <PanelBody className="space-y-4">
          <div className="rounded-md border border-line-subtle bg-bg-app/30 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-secondary">
            Add a licensed real-estate attorney for every state you will close
            in. The desk will refuse to generate a binding contract for any
            property in a state without an active attorney on file. Archived
            profiles are retained for audit but no longer count toward
            coverage.
          </div>

          {attorneysLoading ? (
            <div className="text-[12px] text-ink-muted">Loading roster…</div>
          ) : attorneys.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-subtle bg-bg-app/30 px-3 py-4 text-center text-[12px] text-ink-muted">
              No attorneys on file yet. Add one below to start building
              coverage.
            </div>
          ) : (
            <div className="space-y-2">
              {attorneys.map((attorney) => (
                <div
                  key={attorney.id}
                  className="rounded-md border border-line-subtle bg-bg-surface px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md border border-steel/30 bg-steel/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-steel-bright">
                          {attorney.state}
                        </span>
                        <span className="text-[13px] font-medium text-ink-primary">
                          {attorney.name}
                        </span>
                        {attorney.firmName ? (
                          <span className="text-[11.5px] text-ink-secondary">
                            · {attorney.firmName}
                          </span>
                        ) : null}
                        {attorney.licenseVerifiedAt ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-state-success/30 bg-state-success/10 px-1.5 py-0.5 font-mono text-[10px] text-state-success">
                            <Check className="h-2.5 w-2.5" />
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-ink-secondary">
                        <span className="font-mono">{attorney.email}</span>
                        {attorney.phone ? (
                          <span className="font-mono">{attorney.phone}</span>
                        ) : null}
                        {attorney.barNumber ? (
                          <span className="font-mono">
                            Bar #{attorney.barNumber}
                          </span>
                        ) : null}
                      </div>
                      {attorney.notes ? (
                        <div className="mt-1 text-[11px] leading-5 text-ink-muted">
                          {attorney.notes}
                        </div>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleArchiveAttorney(attorney.id, attorney.name)
                      }
                    >
                      <Archive className="mr-1.5 h-3 w-3" />
                      Archive
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md border border-line-subtle bg-bg-app/50 p-3">
            <div className="flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-state-ai" />
              <div className="text-[13px] font-medium text-ink-primary">
                Add attorney on file
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                  State
                </label>
                <Select
                  value={newAttorney.state}
                  onValueChange={(value) =>
                    setNewAttorney((s) => ({ ...s, state: value }))
                  }
                  disabled={addingAttorney}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {usStateOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label} ({s.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                  Attorney name
                </label>
                <Input
                  value={newAttorney.name}
                  onChange={(e) =>
                    setNewAttorney((s) => ({ ...s, name: e.target.value }))
                  }
                  placeholder="Jane Doe, Esq."
                  disabled={addingAttorney}
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                  Firm name (optional)
                </label>
                <Input
                  value={newAttorney.firmName}
                  onChange={(e) =>
                    setNewAttorney((s) => ({
                      ...s,
                      firmName: e.target.value,
                    }))
                  }
                  placeholder="Doe & Partners LLP"
                  disabled={addingAttorney}
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                  Email
                </label>
                <Input
                  type="email"
                  value={newAttorney.email}
                  onChange={(e) =>
                    setNewAttorney((s) => ({ ...s, email: e.target.value }))
                  }
                  placeholder="jane@doepartners.com"
                  disabled={addingAttorney}
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                  Phone (optional)
                </label>
                <Input
                  value={newAttorney.phone}
                  onChange={(e) =>
                    setNewAttorney((s) => ({ ...s, phone: e.target.value }))
                  }
                  placeholder="(555) 123-4567"
                  disabled={addingAttorney}
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                  Bar # (optional)
                </label>
                <Input
                  value={newAttorney.barNumber}
                  onChange={(e) =>
                    setNewAttorney((s) => ({
                      ...s,
                      barNumber: e.target.value,
                    }))
                  }
                  placeholder="12345"
                  disabled={addingAttorney}
                />
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                Notes (optional)
              </label>
              <Textarea
                value={newAttorney.notes}
                onChange={(e) =>
                  setNewAttorney((s) => ({ ...s, notes: e.target.value }))
                }
                placeholder="Specialties, hourly rate, preferred contact hours, etc."
                disabled={addingAttorney}
                className="min-h-[60px]"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void handleAddAttorney()}
                disabled={
                  addingAttorney ||
                  !newAttorney.state ||
                  !newAttorney.name ||
                  !newAttorney.email
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {addingAttorney ? "Adding…" : "Add attorney"}
              </Button>
            </div>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}

function DealTierActionButton({
  currentMode,
  targetMode,
  working,
  hasActiveAttorneys,
  onDowngrade,
  onOpenOutreachConfirm,
  onOpenContractConfirm,
}: {
  currentMode: DealMode;
  targetMode: DealMode;
  working: boolean;
  hasActiveAttorneys: boolean;
  onDowngrade: () => void;
  onOpenOutreachConfirm: () => void;
  onOpenContractConfirm: () => void;
}) {
  const isDowngrade =
    (currentMode === "contract" &&
      (targetMode === "outreach" || targetMode === "research")) ||
    (currentMode === "outreach" && targetMode === "research");

  if (isDowngrade) {
    return (
      <Button size="sm" variant="outline" onClick={onDowngrade} disabled={working}>
        Downgrade
      </Button>
    );
  }

  if (currentMode === "research" && targetMode === "outreach") {
    return (
      <Button size="sm" onClick={onOpenOutreachConfirm} disabled={working}>
        Upgrade
      </Button>
    );
  }

  if (currentMode === "outreach" && targetMode === "contract") {
    return (
      <Button
        size="sm"
        onClick={onOpenContractConfirm}
        disabled={working || !hasActiveAttorneys}
        className="bg-state-danger text-white hover:brightness-110 disabled:bg-bg-surface-2 disabled:text-ink-muted"
        title={
          !hasActiveAttorneys
            ? "Add at least one attorney on file before upgrading to Contract mode."
            : undefined
        }
      >
        Upgrade to Contract
      </Button>
    );
  }

  // Research → Contract is not a direct path.
  if (currentMode === "research" && targetMode === "contract") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        title="Move through Outreach mode first — TCPA attestation and at least one attorney on file required before Contract unlocks."
      >
        Outreach first
      </Button>
    );
  }

  return null;
}
