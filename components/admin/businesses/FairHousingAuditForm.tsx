"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type Props = {
  businessId: string;
  attestationPhrase: string;
  audit: {
    signedAt: string | null;
    signedBy: string | null;
    notes: string | null;
    ageDays: number | null;
    stale: boolean;
    dueAt: string | null;
  };
};

export function FairHousingAuditForm(props: Props) {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAction(action: "sign" | "retract") {
    setSubmitting(true);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${props.businessId}/code-violations/fair-housing-audit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            acceptedPhrase: action === "sign" ? phrase : "",
            notes: action === "sign" ? notes : "",
            action
          })
        }
      );
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? payload.message ?? "Action failed.");
      }
      toast.success(payload.message ?? "Audit updated.");
      setPhrase("");
      setNotes("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const phraseOk =
    phrase.trim().toUpperCase() === props.attestationPhrase.toUpperCase();
  const signed = Boolean(props.audit.signedAt);

  return (
    <div className="space-y-6">
      <Card
        className={
          signed && !props.audit.stale
            ? "border-emerald-700/40 bg-emerald-700/10"
            : "border-yellow-500/40 bg-yellow-500/5"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <ShieldCheck className="h-4 w-4" />
            Current audit status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {signed ? (
            <>
              <div className={props.audit.stale ? "text-yellow-200" : "text-emerald-300"}>
                Last audit signed by{" "}
                <span className="font-mono">{props.audit.signedBy ?? "operator"}</span> on{" "}
                {props.audit.signedAt
                  ? new Date(props.audit.signedAt).toLocaleString()
                  : "?"}
              </div>
              <div className="text-xs text-ink-muted">
                Audit age:{" "}
                <span className="font-mono">{props.audit.ageDays ?? "?"}</span> days
                {props.audit.dueAt ? (
                  <>
                    {" "}· next due{" "}
                    <span className="font-mono">
                      {new Date(props.audit.dueAt).toLocaleDateString()}
                    </span>
                  </>
                ) : null}
              </div>
              {props.audit.stale ? (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                  Audit is older than 90 days. The State Compliance Review Agent will surface a
                  soft warning on every code-violation outreach draft until you record a fresh
                  audit. Outreach is NOT blocked — but operators should refresh before scaling.
                </div>
              ) : null}
              {props.audit.notes ? (
                <details className="text-xs">
                  <summary className="cursor-pointer text-ink-muted hover:text-white">
                    Audit notes
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded-md border border-line-subtle bg-bg-base p-3 font-mono text-[11px] text-ink-muted">
                    {props.audit.notes}
                  </pre>
                </details>
              ) : null}
            </>
          ) : (
            <div className="text-yellow-200">
              No Fair Housing audit on file. Outreach is not blocked, but the Compliance Review
              Agent will surface a warning on every draft. Record an audit before scaling
              code-violation outreach.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">
            Record a new audit (operator self-attestation)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-ink-muted">
            Fair Housing disparate-impact risk is the highest single risk for code-violation
            outreach. Code-violation density correlates with race + national origin in many
            MSAs — Inclusive Communities (2015), HUD/CFPB 2024 algorithmic-targeting guidance.
            By signing this attestation you confirm you have run a disparate-impact review
            across the operator's lead-selection algorithm + outreach lists by census tract
            within the last 90 days.
          </p>

          <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-3 text-xs text-ink-muted">
            Recommended audit methodology:
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Pull last quarter's CodeViolationRecord rows that hit outreach.</li>
              <li>Geocode + tag census tract via the existing geocoder.</li>
              <li>
                Compare the racial/national-origin demographic of the outreach list against
                the eligible-property demographic of each market.
              </li>
              <li>
                Disparity threshold: if outreach minority share exceeds eligible-property
                minority share by &gt;20%, flag for methodology review.
              </li>
              <li>Document anomalies + corrective actions in the notes field below.</li>
            </ol>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-ink-muted">
              Type the attestation phrase exactly:{" "}
              <code className="font-mono text-white">{props.attestationPhrase}</code>
            </label>
            <Input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={props.attestationPhrase}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-ink-muted">Audit notes (optional)</label>
            <Textarea
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                "Quarter Q2 2026 audit. 1,247 leads reviewed across 4 metros. Disparity flag triggered in Detroit (8th & Cass tract); methodology adjusted to include tax-delinquent + high-equity overlay. No anomalies in other markets."
              }
              className="font-mono text-xs"
            />
            <p className="text-xs text-ink-muted">
              Optional but recommended. Retained 5 years for the audit defense.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleAction("sign")}
              disabled={!phraseOk || submitting}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Record audit
            </Button>
            {signed ? (
              <Button
                variant="ghost"
                onClick={() => handleAction("retract")}
                disabled={submitting}
              >
                Retract current audit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
