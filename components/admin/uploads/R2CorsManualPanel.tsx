"use client";

import { Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/**
 * Exact shape produced by buildR2CorsPolicy in lib/storage/r2.ts.
 * Kept local (not imported) so this client component stays free of
 * server-only dependencies.
 */
export type R2CorsRule = {
  AllowedOrigins: string[];
  AllowedMethods: string[];
  AllowedHeaders: string[];
  ExposeHeaders: string[];
  MaxAgeSeconds: number;
};

type Props = {
  manual: {
    rules: unknown;
    instructions?: string[];
  };
};

function isCorsRuleArray(value: unknown): value is R2CorsRule[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    Array.isArray((value[0] as Record<string, unknown>).AllowedOrigins)
  );
}

export function R2CorsManualPanel({ manual }: Props) {
  const rules = isCorsRuleArray(manual.rules) ? manual.rules : null;
  const rule = rules?.[0] ?? null;
  const origins = rule?.AllowedOrigins ?? [];
  const jsonText = JSON.stringify(manual.rules, null, 2);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(jsonText);
      toast.success("CORS JSON copied. Paste into Cloudflare's CORS editor.");
    } catch {
      toast.error("Clipboard not available.");
    }
  }

  async function copyOrigins() {
    try {
      await navigator.clipboard.writeText(origins.join("\n"));
      toast.success("Origin copied.");
    } catch {
      toast.error("Clipboard not available.");
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-state-warning/40 bg-state-warning/5 p-3 text-xs">
      <p className="font-medium text-state-warning">
        Your R2 API token can&apos;t auto-configure CORS — do it once by
        hand (about a minute):
      </p>

      <ol className="list-decimal space-y-1 pl-4 text-ink-primary">
        <li>
          Open the{" "}
          <a
            href="https://dash.cloudflare.com/?to=/:account/r2/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-steel-bright underline"
          >
            Cloudflare R2 dashboard
          </a>{" "}
          and click your bucket.
        </li>
        <li>
          Click the <strong>Settings</strong> tab at the top.
        </li>
        <li>
          Scroll down to the <strong>CORS Policy</strong> row and click
          the <strong>+ Add</strong> button on the right side of that row.
        </li>
        <li>
          Depending on your Cloudflare UI, you&apos;ll see either a{" "}
          <strong>JSON editor</strong> (paste the JSON below) or a
          <strong> form with fields</strong> (use the field-by-field
          values below).
        </li>
        <li>Click Save, then retry the upload here.</li>
      </ol>

      {rule ? (
        <div className="rounded border border-white/10 bg-bg-app/40 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-secondary">
            Option A — form fields
          </div>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11px] text-ink-primary">
            <dt className="text-ink-secondary">Allowed Origins</dt>
            <dd className="flex items-center gap-2">
              <code className="truncate">{origins.join(", ")}</code>
              {origins.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={copyOrigins}
                  className="h-5 px-1"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              ) : null}
            </dd>

            <dt className="text-ink-secondary">Allowed Methods</dt>
            <dd>
              <code>{rule.AllowedMethods.join(", ")}</code>
            </dd>

            <dt className="text-ink-secondary">Allowed Headers</dt>
            <dd>
              <code>{rule.AllowedHeaders.join(", ")}</code>
              {rule.AllowedHeaders.includes("*") ? (
                <span className="ml-2 text-[10px] text-ink-muted">
                  (if a form won&apos;t accept <code>*</code>, enter{" "}
                  <code>Content-Type</code>)
                </span>
              ) : null}
            </dd>

            <dt className="text-ink-secondary">Expose Headers</dt>
            <dd>
              <code>{rule.ExposeHeaders.join(", ") || "(leave empty)"}</code>
            </dd>

            <dt className="text-ink-secondary">Max Age Seconds</dt>
            <dd>
              <code>{rule.MaxAgeSeconds}</code>
            </dd>
          </dl>
        </div>
      ) : null}

      <div>
        <div className="mb-1 text-[10px] uppercase tracking-wide text-ink-secondary">
          Option B — JSON editor
        </div>
        <pre className="max-h-64 overflow-auto rounded bg-bg-app/60 p-2 font-mono text-[11px] text-ink-primary">
          {jsonText}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyJson}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy JSON
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a
            href="https://dash.cloudflare.com/?to=/:account/r2/overview"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open Cloudflare R2
          </a>
        </Button>
        <span className="ml-auto text-ink-muted">
          Or re-issue your R2 token with Admin Read + Write and click
          Configure CORS again.
        </span>
      </div>
    </div>
  );
}
