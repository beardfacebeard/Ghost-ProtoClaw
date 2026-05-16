"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronDown, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type StateRow = {
  state: string;
  fullName: string;
  tier: "low" | "state_disclosure" | "rescission" | "criminal_exposure";
  regime: "judicial" | "non_judicial" | "hybrid" | "mixed_with_oversight";
  rescissionDays: number | null;
  rescissionBusinessDays: boolean;
  statutoryNotice: string | null;
  exposureSummary: string;
  references: string[];
  lastReviewedAt: string;
  attested: boolean;
  attestedAt: string | null;
  attestedBy: string | null;
  hasTemplateOverride: boolean;
};

type GlbaInfo = {
  signed: boolean;
  signedAt: string | null;
  signedBy: string | null;
  attestationPhrase: string;
};

type Props = {
  businessId: string;
  businessName: string;
  attestationPhrase: string;
  states: StateRow[];
  glba: GlbaInfo;
};

const TIER_LABEL: Record<StateRow["tier"], string> = {
  low: "Low",
  state_disclosure: "State disclosure",
  rescission: "Rescission required",
  criminal_exposure: "Criminal exposure"
};

const TIER_COLOR: Record<StateRow["tier"], string> = {
  low: "text-ink-muted",
  state_disclosure: "text-blue-300",
  rescission: "text-yellow-300",
  criminal_exposure: "text-red-400"
};

export function ForeclosureComplianceManager(props: Props) {
  const router = useRouter();
  const [states, setStates] = useState<StateRow[]>(props.states);
  const [glba, setGlba] = useState<GlbaInfo>(props.glba);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [phraseByState, setPhraseByState] = useState<Record<string, string>>({});
  const [overrideByState, setOverrideByState] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [glbaPhrase, setGlbaPhrase] = useState("");
  const [glbaSubmitting, setGlbaSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "criminal" | "not_attested">("all");
  const [bulkPhrase, setBulkPhrase] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const filtered = useMemo(() => {
    let rows = states;
    if (filter === "criminal") rows = rows.filter((s) => s.tier === "criminal_exposure");
    if (filter === "not_attested") rows = rows.filter((s) => !s.attested);
    return rows;
  }, [states, filter]);

  const summary = useMemo(() => {
    const attested = states.filter((s) => s.attested).length;
    const criminal = states.filter((s) => s.tier === "criminal_exposure");
    const criminalAttested = criminal.filter((s) => s.attested).length;
    return {
      attested,
      total: states.length,
      criminalAttested,
      criminalTotal: criminal.length
    };
  }, [states]);

  async function handleAttest(state: string, action: "attest" | "retract") {
    setSubmitting(`${state}:${action}`);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${props.businessId}/foreclosures/compliance`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            state,
            acceptedPhrase: action === "attest" ? phraseByState[state] ?? "" : "",
            templateOverride: overrideByState[state]?.trim() || undefined,
            action
          })
        }
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        attested?: boolean;
        attestation?: { attestedAt: string; attestedBy: string };
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? payload.message ?? "Attestation failed.");
      }
      toast.success(payload.message ?? `${state} updated.`);
      setStates((prev) =>
        prev.map((s) =>
          s.state === state
            ? {
                ...s,
                attested: payload.attested ?? false,
                attestedAt: payload.attestation?.attestedAt ?? null,
                attestedBy: payload.attestation?.attestedBy ?? null,
                hasTemplateOverride:
                  action === "attest"
                    ? Boolean(overrideByState[state]?.trim())
                    : false
              }
            : s
        )
      );
      setPhraseByState((p) => ({ ...p, [state]: "" }));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Attestation failed.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleBulkAttest() {
    // Sign every UNATTESTED state in the current filtered view, in a single
    // request. Eliminates the 50-state click-paste-confirm grind.
    const targets = filtered.filter((s) => !s.attested).map((s) => s.state);
    if (targets.length === 0) {
      toast.error("No unattested states in the current filter.");
      return;
    }
    setBulkSubmitting(true);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${props.businessId}/foreclosures/compliance`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            states: targets,
            acceptedPhrase: bulkPhrase,
            action: "attest"
          })
        }
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        states?: string[];
        attested?: number;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? payload.message ?? "Bulk attestation failed.");
      }
      toast.success(payload.message ?? `Attested ${targets.length} states.`);
      const stamp = new Date().toISOString();
      const targetSet = new Set(targets);
      setStates((prev) =>
        prev.map((s) =>
          targetSet.has(s.state)
            ? { ...s, attested: true, attestedAt: stamp }
            : s
        )
      );
      setBulkPhrase("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk attestation failed.");
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function handleGlba(action: "sign" | "retract") {
    setGlbaSubmitting(true);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${props.businessId}/foreclosures/glba`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            acceptedPhrase: action === "sign" ? glbaPhrase : "",
            action
          })
        }
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        signed?: boolean;
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? payload.message ?? "GLBA attestation failed.");
      }
      toast.success(payload.message ?? "GLBA attestation updated.");
      setGlba((prev) => ({
        ...prev,
        signed: payload.signed ?? false,
        signedAt: payload.signed ? new Date().toISOString() : null
      }));
      setGlbaPhrase("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "GLBA attestation failed.");
    } finally {
      setGlbaSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Compliance summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-3xl font-semibold text-white">
              {summary.attested} / {summary.total}
            </div>
            <div className="text-xs text-ink-muted">states attested</div>
          </div>
          <div>
            <div className="text-3xl font-semibold text-white">
              {summary.criminalAttested} / {summary.criminalTotal}
            </div>
            <div className="text-xs text-ink-muted">
              criminal-exposure states attested (CA/MD/IL/MN/CO/NY/FL)
            </div>
          </div>
          <div>
            <div
              className={`text-3xl font-semibold ${glba.signed ? "text-emerald-400" : "text-red-400"}`}
            >
              {glba.signed ? "Signed" : "Not signed"}
            </div>
            <div className="text-xs text-ink-muted">GLBA / DPPA skip-trace attestation</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">
            GLBA / DPPA attestation (skip-trace)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-ink-muted">
            Required before any skip-trace query fires for a foreclosure record. Records your
            acknowledgment that you understand the permissible-purpose framework and will record a
            valid purposeCode on every query. Even after signing, queries still default to manual
            operator approval ($0/mo cap — decision #6) until you raise the cap in spend ceilings.
          </p>
          {glba.signed ? (
            <div className="flex items-center justify-between rounded-md border border-emerald-700/40 bg-emerald-700/10 px-4 py-3">
              <div>
                <div className="text-emerald-300">
                  Signed by {glba.signedBy ?? "operator"} ·{" "}
                  {glba.signedAt ? new Date(glba.signedAt).toLocaleString() : ""}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleGlba("retract")}
                disabled={glbaSubmitting}
              >
                {glbaSubmitting ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : null}
                Retract
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-ink-muted">
                Type the phrase exactly to sign:{" "}
                <code className="font-mono text-white">{glba.attestationPhrase}</code>
              </div>
              <Input
                value={glbaPhrase}
                onChange={(e) => setGlbaPhrase(e.target.value)}
                placeholder={glba.attestationPhrase}
                className="font-mono text-xs"
              />
              <Button onClick={() => handleGlba("sign")} disabled={glbaSubmitting || !glbaPhrase}>
                {glbaSubmitting ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : null}
                Sign GLBA / DPPA attestation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base text-white">Per-state attestations</CardTitle>
          <div className="flex gap-2 text-xs">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All ({states.length})
            </Button>
            <Button
              variant={filter === "criminal" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("criminal")}
            >
              Criminal exposure
            </Button>
            <Button
              variant={filter === "not_attested" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("not_attested")}
            >
              Not yet attested
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filter !== "all" &&
            filtered.some((s) => !s.attested) && (
              <div className="rounded-md border border-blue-700/40 bg-blue-700/5 p-3 text-xs">
                <div className="mb-2 text-blue-200">
                  Bulk-attest{" "}
                  <strong className="text-white">
                    {filtered.filter((s) => !s.attested).length}
                  </strong>{" "}
                  unattested states in this view with one phrase. Saves the
                  50-state click-paste-confirm grind.
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={bulkPhrase}
                    onChange={(e) => setBulkPhrase(e.target.value)}
                    placeholder={props.attestationPhrase}
                    className="font-mono text-xs sm:flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleBulkAttest}
                    disabled={
                      bulkSubmitting ||
                      bulkPhrase.trim().toUpperCase() !==
                        props.attestationPhrase.toUpperCase()
                    }
                  >
                    {bulkSubmitting ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    Attest {filtered.filter((s) => !s.attested).length} states
                  </Button>
                </div>
                <div className="mt-2 text-[11px] text-blue-200/70">
                  Each state is recorded with the same timestamp + your
                  operator email. Counsel-reviewed templateOverride is only
                  honored when you attest a state individually below.
                </div>
              </div>
            )}
          {filtered.map((s) => {
            const isOpen = expanded === s.state;
            const phrase = phraseByState[s.state] ?? "";
            const override = overrideByState[s.state] ?? "";
            const phraseOk =
              phrase.trim().toUpperCase() === props.attestationPhrase.toUpperCase();
            const subKey = `${s.state}:attest`;
            const retractKey = `${s.state}:retract`;
            return (
              <div
                key={s.state}
                className="rounded-md border border-line-subtle bg-bg-surface-2/40"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : s.state)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        s.attested
                          ? "bg-emerald-700/30 text-emerald-300"
                          : s.tier === "criminal_exposure"
                            ? "bg-red-700/20 text-red-400"
                            : "bg-bg-surface-3 text-ink-muted"
                      }`}
                    >
                      {s.attested ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : s.tier === "criminal_exposure" ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {s.fullName}{" "}
                        <span className="font-mono text-xs text-ink-muted">[{s.state}]</span>
                      </div>
                      <div className="text-xs text-ink-muted">
                        <span className={TIER_COLOR[s.tier]}>{TIER_LABEL[s.tier]}</span>
                        {" · "}
                        {s.regime}
                        {s.rescissionDays
                          ? ` · ${s.rescissionDays} ${s.rescissionBusinessDays ? "business " : ""}days rescission`
                          : ""}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-ink-muted transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen ? (
                  <div className="space-y-4 border-t border-line-subtle px-3 py-3 text-sm">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-ink-muted">
                        Exposure
                      </div>
                      <div className="mt-1 text-ink-muted">{s.exposureSummary}</div>
                      {s.references.length > 0 ? (
                        <div className="mt-2 font-mono text-xs text-ink-muted">
                          {s.references.join(" · ")}
                        </div>
                      ) : null}
                    </div>

                    {s.statutoryNotice ? (
                      <details className="space-y-2">
                        <summary className="cursor-pointer text-xs uppercase tracking-wider text-ink-muted hover:text-white">
                          Ship-default statutory notice
                        </summary>
                        <pre className="mt-2 overflow-x-auto rounded-md border border-line-subtle bg-bg-base p-3 font-mono text-[11px] leading-relaxed text-ink-muted">
                          {s.statutoryNotice}
                        </pre>
                      </details>
                    ) : null}

                    {s.attested ? (
                      <div className="space-y-3">
                        <div className="rounded-md border border-emerald-700/40 bg-emerald-700/10 p-3 text-xs">
                          <div className="text-emerald-300">
                            Attested by {s.attestedBy ?? "operator"} ·{" "}
                            {s.attestedAt ? new Date(s.attestedAt).toLocaleString() : ""}
                          </div>
                          {s.hasTemplateOverride ? (
                            <div className="mt-1 text-emerald-200/80">
                              Counsel-reviewed template override on file.
                            </div>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAttest(s.state, "retract")}
                          disabled={submitting === retractKey}
                        >
                          {submitting === retractKey ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : null}
                          Retract attestation
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-xs text-ink-muted">
                          Optional: paste counsel-reviewed notice to override the ship-default for{" "}
                          {s.fullName}.
                        </div>
                        <Textarea
                          rows={5}
                          value={override}
                          onChange={(e) =>
                            setOverrideByState((p) => ({ ...p, [s.state]: e.target.value }))
                          }
                          placeholder={
                            "(optional) Paste counsel-reviewed statutory notice for this state…"
                          }
                          className="font-mono text-xs"
                        />
                        <div className="text-xs text-ink-muted">
                          Type the attestation phrase to confirm:{" "}
                          <code className="font-mono text-white">{props.attestationPhrase}</code>
                        </div>
                        <Input
                          value={phrase}
                          onChange={(e) =>
                            setPhraseByState((p) => ({ ...p, [s.state]: e.target.value }))
                          }
                          placeholder={props.attestationPhrase}
                          className="font-mono text-xs"
                        />
                        <Button
                          onClick={() => handleAttest(s.state, "attest")}
                          disabled={!phraseOk || submitting === subKey}
                        >
                          {submitting === subKey ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : null}
                          Attest for {s.fullName}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-6 text-center text-sm text-ink-muted">
              No states match the current filter.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
