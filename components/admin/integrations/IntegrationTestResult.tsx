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
      <div className="flex items-center gap-2 rounded-xl border border-ghost-border bg-ghost-raised/30 px-3 py-2 text-sm text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin text-brand-cyan" />
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
          ? "border-status-active/30 bg-status-active/10 text-slate-100"
          : "border-status-error/30 bg-status-error/10 text-slate-100"
      }`}
    >
      {result.success ? (
        <CheckCircle2 className="h-4 w-4 text-status-active" />
      ) : (
        <XCircle className="h-4 w-4 text-status-error" />
      )}
      <span>{result.message}</span>
    </div>
  );
}
