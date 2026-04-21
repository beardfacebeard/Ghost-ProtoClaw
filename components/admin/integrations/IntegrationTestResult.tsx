"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

type IntegrationTestResultProps = {
  result: { success: boolean; message: string } | null;
  loading: boolean;
};

export function IntegrationTestResult({
  result,
  loading
}: IntegrationTestResultProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line-subtle bg-bg-surface-2/30 px-3 py-2 text-sm text-ink-primary">
        <Loader2 className="h-4 w-4 animate-spin text-steel-bright" />
        Testing connection...
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
        result.success
          ? "border-state-success/30 bg-state-success/10 text-slate-100"
          : "border-status-error/30 bg-state-danger/10 text-slate-100"
      }`}
    >
      {result.success ? (
        <CheckCircle2 className="h-4 w-4 text-state-success" />
      ) : (
        <XCircle className="h-4 w-4 text-state-danger" />
      )}
      <span>{result.message}</span>
    </div>
  );
}
