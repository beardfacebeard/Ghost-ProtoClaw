"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, MapPin, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type Candidate = {
  id: string;
  module: "pre_foreclosure" | "code_violation";
  propertyAddress: string;
  city: string | null;
  state: string;
  ownerName: string | null;
  signalLabel: string;
  scoreSnapshot: number | null;
};

type RecentVisit = {
  id: string;
  visitedAt: string;
  outcome: string;
  sourceModule: string;
  propertyAddress: string;
  signageObserved: string[];
  notes: string | null;
};

type Props = {
  businessId: string;
  candidates: Candidate[];
  recentVisits: RecentVisit[];
};

const OUTCOMES = [
  { value: "no_answer", label: "No answer" },
  { value: "declined", label: "Declined" },
  { value: "conversation", label: "Had conversation" },
  { value: "leave_behind", label: "Left a note" },
  { value: "vacant_confirmed", label: "Confirmed vacant" },
  { value: "occupied_confirmed", label: "Confirmed occupied" },
  { value: "unsafe", label: "Unsafe / abort" },
  { value: "inaccessible", label: "Inaccessible (gated, etc.)" },
  { value: "no_knock_signage", label: "No-knock signage observed" }
];

const SIGNAGE = [
  { value: "no_soliciting", label: "No Soliciting" },
  { value: "no_trespassing", label: "No Trespassing" },
  { value: "beware_of_dog", label: "Beware of Dog" },
  { value: "for_sale_by_owner", label: "For Sale by Owner" },
  { value: "no_signage_observed", label: "No signage observed" }
];

export function FieldVisitManager(props: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [logging, setLogging] = useState<string | null>(null);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logOutcome, setLogOutcome] = useState("no_answer");
  const [logSignage, setLogSignage] = useState<string[]>([]);
  const [logNotes, setLogNotes] = useState("");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Google Maps multi-stop URLs cap at 10 stops. Reject the 11th
        // selection instead of silently truncating it — previously the
        // operator would tick 25 boxes and only 10 would land in the URL.
        if (next.size >= 10) {
          toast.error(
            "Max 10 stops per route (Google Maps cap). Deselect one to add another, or plan multiple trips."
          );
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  const mapsUrl = useMemo(() => {
    const picks = props.candidates.filter((c) => selected.has(c.id));
    if (picks.length === 0) return null;
    // Google Maps multi-stop directions URL — origin + waypoints +
    // destination. Cap at 10 stops (Google's free-tier limit).
    const trimmed = picks.slice(0, 10);
    if (trimmed.length === 1) {
      const addr = encodeURIComponent(
        `${trimmed[0].propertyAddress}, ${trimmed[0].city ?? ""}, ${trimmed[0].state}`
      );
      return `https://www.google.com/maps/search/?api=1&query=${addr}`;
    }
    const origin = encodeURIComponent(
      `${trimmed[0].propertyAddress}, ${trimmed[0].city ?? ""}, ${trimmed[0].state}`
    );
    const destination = encodeURIComponent(
      `${trimmed[trimmed.length - 1].propertyAddress}, ${
        trimmed[trimmed.length - 1].city ?? ""
      }, ${trimmed[trimmed.length - 1].state}`
    );
    const waypoints = trimmed
      .slice(1, -1)
      .map((c) =>
        encodeURIComponent(`${c.propertyAddress}, ${c.city ?? ""}, ${c.state}`)
      )
      .join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
      waypoints ? `&waypoints=${waypoints}` : ""
    }`;
  }, [props.candidates, selected]);

  async function submitLog(candidate: Candidate) {
    setLogSubmitting(true);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${props.businessId}/field-visits`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            outcome: logOutcome,
            signageObserved: logSignage,
            notes: logNotes.trim() || undefined,
            sourceModule: candidate.module,
            ...(candidate.module === "code_violation"
              ? { codeViolationRecordId: candidate.id }
              : { foreclosureRecordId: candidate.id })
          })
        }
      );
      const payload = (await response.json()) as { ok?: boolean; message?: string; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? payload.message ?? "Log failed.");
      }
      toast.success("Visit logged.");
      setLogging(null);
      setLogOutcome("no_answer");
      setLogSignage([]);
      setLogNotes("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Log failed.");
    } finally {
      setLogSubmitting(false);
    }
  }

  function toggleSignage(val: string) {
    setLogSignage((prev) =>
      prev.includes(val) ? prev.filter((s) => s !== val) : [...prev, val]
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Field-visit safety rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-ink-muted">
          <p>
            <strong className="text-white">Universal rules</strong> the operator must follow on every visit:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Time window 9:00 AM - 7:00 PM operator local time.</li>
            <li>
              Visible No-Soliciting / No-Trespass / Beware-of-Dog signage = abort. Log
              "no_knock_signage" to add this property to the per-business no-knock list.
            </li>
            <li>Front door only. Do NOT walk to side/rear; do NOT open gates.</li>
            <li>No structure entry. Period.</li>
            <li>
              <strong className="text-white">Never place anything in or on a mailbox</strong> —
              18 U.S.C. § 1725 is a federal crime ($5,000/item). Door-handle leave-behind only.
            </li>
            <li>No photos of identifiable people. Exterior-only from public ROW.</li>
            <li>
              Some cities require a solicitor permit for door-to-door visits. Verify your
              city's ordinance before knocking; operating without a permit may carry civil
              penalties.
            </li>
            <li>
              For pre-foreclosure leads — every leave-behind routes through State Compliance
              Review + per-state attestation (CA/MD/IL/MN/CO/NY/FL).
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base text-white">
            Top distress leads — pick a route ({selected.size}/10 selected)
          </CardTitle>
          <div className="flex gap-2 text-xs">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm">
                  <MapPin className="mr-2 h-3 w-3" />
                  Open in Google Maps
                </Button>
              </a>
            ) : (
              <Button size="sm" disabled>
                <MapPin className="mr-2 h-3 w-3" />
                Select properties
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {props.candidates.length === 0 ? (
            <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-6 text-center text-sm text-ink-muted">
              No qualifying records yet. Enable an addon + wait for the daily sweep, or upload
              a CSV.
            </div>
          ) : (
            <div className="space-y-2">
              {props.candidates.map((c) => {
                const isSelected = selected.has(c.id);
                const isLogging = logging === c.id;
                return (
                  <div
                    key={`${c.module}:${c.id}`}
                    className={`rounded-md border ${
                      isSelected ? "border-steel/40 bg-steel/10" : "border-line-subtle bg-bg-surface-2/40"
                    } p-3`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(c.id)}
                        disabled={!isSelected && selected.size >= 10}
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          isSelected
                            ? "border-steel bg-steel/30 text-white"
                            : "border-line-subtle text-ink-muted"
                        }`}
                      >
                        {isSelected ? <CheckCircle2 className="h-3 w-3" /> : null}
                      </button>
                      <div className="flex-1">
                        <div className="text-sm text-white">
                          {c.propertyAddress}
                          <span className="ml-2 font-mono text-xs text-ink-muted">
                            {c.city ? `${c.city}, ` : ""}
                            {c.state}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-ink-muted">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 font-mono uppercase ${
                              c.module === "pre_foreclosure"
                                ? "bg-red-700/20 text-red-300"
                                : "bg-blue-700/20 text-blue-300"
                            }`}
                          >
                            {c.module === "pre_foreclosure" ? "Pre-FC" : "Code"}
                          </span>
                          <span>{c.signalLabel}</span>
                          <span>·</span>
                          <span className="font-mono text-white">
                            score {c.scoreSnapshot ?? "—"}
                          </span>
                          {c.ownerName ? (
                            <>
                              <span>·</span>
                              <span>{c.ownerName}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLogging(isLogging ? null : c.id);
                          setLogOutcome("no_answer");
                          setLogSignage([]);
                          setLogNotes("");
                        }}
                      >
                        {isLogging ? (
                          <>
                            <X className="mr-1 h-3 w-3" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <Plus className="mr-1 h-3 w-3" />
                            Log visit
                          </>
                        )}
                      </Button>
                    </div>
                    {isLogging ? (
                      <div className="mt-3 space-y-3 border-t border-line-subtle pt-3 text-xs">
                        <div>
                          <div className="mb-1 text-ink-muted">Outcome</div>
                          <select
                            value={logOutcome}
                            onChange={(e) => setLogOutcome(e.target.value)}
                            className="w-full rounded-md border border-line-subtle bg-bg-surface-2/40 px-3 py-2 font-mono text-xs text-white"
                          >
                            {OUTCOMES.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <div className="mb-1 text-ink-muted">Signage observed</div>
                          <div className="flex flex-wrap gap-2">
                            {SIGNAGE.map((s) => {
                              const on = logSignage.includes(s.value);
                              return (
                                <button
                                  type="button"
                                  key={s.value}
                                  onClick={() => toggleSignage(s.value)}
                                  className={`rounded-md border px-2 py-1 text-xs ${
                                    on
                                      ? "border-steel/40 bg-steel/15 text-white"
                                      : "border-line-subtle bg-bg-surface-2/40 text-ink-muted hover:text-white"
                                  }`}
                                >
                                  {s.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-ink-muted">Notes (optional)</div>
                          <Textarea
                            rows={3}
                            value={logNotes}
                            onChange={(e) => setLogNotes(e.target.value)}
                            placeholder="e.g. 'Property appears vacant. Boarded windows on 2nd floor. Left note on door handle.'"
                            className="text-xs"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => submitLog(c)}
                          disabled={logSubmitting}
                        >
                          {logSubmitting ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          ) : null}
                          Submit visit log
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">Recent visits</CardTitle>
        </CardHeader>
        <CardContent>
          {props.recentVisits.length === 0 ? (
            <div className="rounded-md border border-line-subtle bg-bg-surface-2/40 p-6 text-center text-sm text-ink-muted">
              No visits logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs">
                <thead>
                  <tr className="border-b border-line-subtle text-left text-ink-muted">
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">When</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Module</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Property</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Outcome</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Signage</th>
                    <th className="px-3 py-2 font-mono uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {props.recentVisits.map((v) => (
                    <tr key={v.id} className="border-b border-line-subtle/50">
                      <td className="px-3 py-2 font-mono text-ink-muted">
                        {new Date(v.visitedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-ink-muted">
                        {v.sourceModule}
                      </td>
                      <td className="px-3 py-2 text-white">{v.propertyAddress}</td>
                      <td className="px-3 py-2 text-ink-muted">{v.outcome}</td>
                      <td className="px-3 py-2 text-ink-muted">
                        {v.signageObserved.length > 0
                          ? v.signageObserved.join(", ")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">
                        {v.notes ? (
                          v.notes.length > 60 ? (
                            <span title={v.notes}>
                              {v.notes.slice(0, 57)}…
                            </span>
                          ) : (
                            v.notes
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <a
        href="https://www.law.cornell.edu/uscode/text/18/1725"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-white"
      >
        <ExternalLink className="h-3 w-3" />
        18 U.S.C. § 1725 (mailbox restriction reference)
      </a>
    </div>
  );
}
