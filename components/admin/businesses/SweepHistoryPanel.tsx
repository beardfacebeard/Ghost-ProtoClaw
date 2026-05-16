"use client";

import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type SweepRun = {
  id: string;
  ranAt: string; // ISO
  level: string; // "info" | "warning" | "error"
  message: string;
  inserted: number;
  candidates: number;
  duplicatesSkipped: number;
  errors: string[];
};

type Props = {
  /** "Pre-foreclosure" | "Code violation" */
  moduleLabel: string;
  runs: SweepRun[];
};

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SweepHistoryPanel({ moduleLabel, runs }: Props) {
  return (
    <Card className="border-line-subtle bg-bg-surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Activity className="h-4 w-4" />
          {moduleLabel} sweep history
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {runs.length === 0 ? (
          <div className="rounded-md border border-line-subtle bg-bg-canvas/40 p-4 text-xs text-ink-muted">
            No sweeps have run yet. The daily sweep fires at the business&apos;s
            sourcing sweep hour (default 6am local). If you just enabled the
            addon, the first sweep will run on the next tick after that hour.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-line-subtle">
            <table className="w-full text-xs">
              <thead className="bg-bg-canvas/40 text-ink-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">When</th>
                  <th className="px-3 py-2 text-left font-medium">Result</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Ingested
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Candidates
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Dupes skipped
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const hasErrors = r.errors.length > 0 || r.level === "error";
                  const warning = r.level === "warning" && !hasErrors;
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-line-subtle align-top"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                        {relativeTime(r.ranAt)}
                      </td>
                      <td className="px-3 py-2">
                        {hasErrors ? (
                          <span className="inline-flex items-center gap-1 text-red-300">
                            <AlertTriangle className="h-3 w-3" />
                            Failed
                          </span>
                        ) : warning ? (
                          <span className="inline-flex items-center gap-1 text-yellow-300">
                            <AlertTriangle className="h-3 w-3" />
                            Partial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-white">
                        {r.inserted}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-muted">
                        {r.candidates}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-muted">
                        {r.duplicatesSkipped}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">
                        {r.errors.length === 0 ? (
                          <span>—</span>
                        ) : (
                          <details>
                            <summary className="cursor-pointer text-red-300">
                              {r.errors.length} error
                              {r.errors.length === 1 ? "" : "s"}
                            </summary>
                            <ul className="mt-2 space-y-1">
                              {r.errors.slice(0, 5).map((e, i) => (
                                <li
                                  key={i}
                                  className="font-mono text-[11px] text-red-200/80"
                                >
                                  {e}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
