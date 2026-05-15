"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type ImportLeadsFormProps = {
  businessId: string;
  businessName: string;
};

type ImportResponse = {
  imported: number;
  signalsCreated: number;
  dealIds: string[];
  errors: Array<{ rowNumber: number; message: string }>;
  message: string;
};

const MAX_FILE_SIZE_MB = 5;

export function ImportLeadsForm({ businessId, businessName }: ImportLeadsFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(
    null
  );
  const [sourceLabel, setSourceLabel] = useState("manual_import");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  function previewCsv(text: string) {
    // Lightweight preview — splits on first newline, then commas. The real
    // parse happens server-side via lib/dealhawk/csv-import.ts, which
    // handles quoted fields properly. This is just a quick visual.
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setPreview(null);
      return;
    }
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines
      .slice(1, 6)
      .map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
    setPreview({ headers, rows });
  }

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Max ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    previewCsv(text);
  }

  async function handleSubmit() {
    if (!csvText.trim()) {
      toast.error("Paste CSV text or upload a file first.");
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/deals/import`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            csv: csvText,
            source: sourceLabel.trim() || "manual_import"
          })
        }
      );
      const payload = (await response.json()) as ImportResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? "Import failed.");
      }
      setResult(payload);
      if (payload.imported > 0) {
        toast.success(
          `${payload.imported} lead${payload.imported === 1 ? "" : "s"} imported into ${businessName}.`
        );
        router.refresh();
      } else {
        toast.error(
          "No rows imported. Check the error list below — most likely missing address / city / state / zip columns."
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setFileName(null);
    setCsvText("");
    setPreview(null);
    setResult(null);
    setSourceLabel("manual_import");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">1. Pick your CSV file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          {!csvText ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line-subtle bg-bg-surface-2/40 px-6 py-12 text-center transition-colors hover:border-steel/40 hover:bg-bg-surface-2/60"
            >
              <Upload className="h-6 w-6 text-ink-muted" />
              <div className="text-sm font-medium text-white">
                Drop your CSV here or click to browse
              </div>
              <div className="text-xs text-ink-muted">
                Max {MAX_FILE_SIZE_MB} MB · up to 1,000 rows per upload · PropStream / BatchData /
                REISIFT exports work out of the box
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md border border-line-subtle bg-bg-surface-2/40 p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-steel" />
                <div className="text-sm">
                  <div className="font-medium text-white">{fileName ?? "Pasted CSV"}</div>
                  <div className="text-xs text-ink-muted">
                    {(csvText.length / 1024).toFixed(1)} KB · ~{csvText.split("\n").length - 1} rows
                  </div>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Clear
              </Button>
            </div>
          )}

          <details className="space-y-2 text-xs text-ink-muted">
            <summary className="cursor-pointer hover:text-white">
              ...or paste raw CSV text instead
            </summary>
            <Textarea
              rows={6}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                previewCsv(e.target.value);
                setFileName(null);
              }}
              placeholder="Property Address,City,State,Zip,Owner Name,Equity %,...&#10;123 Main St,Memphis,TN,38103,John Smith,55,..."
              className="font-mono text-xs"
            />
          </details>
        </CardContent>
      </Card>

      {preview && (
        <Card className="border-line-subtle bg-bg-surface">
          <CardHeader>
            <CardTitle className="text-base text-white">
              2. Preview — first {preview.rows.length} rows
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto rounded-md border border-line-subtle">
              <table className="min-w-full text-xs">
                <thead className="bg-bg-surface-2/40">
                  <tr>
                    {preview.headers.map((h, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap border-b border-line-subtle px-3 py-2 text-left font-mono text-[10.5px] uppercase tracking-wide text-ink-secondary"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-line-subtle last:border-0">
                      {row.map((c, ci) => (
                        <td
                          key={ci}
                          className="max-w-[180px] truncate whitespace-nowrap px-3 py-2 text-ink-primary"
                          title={c}
                        >
                          {c || <span className="text-ink-muted">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-ink-secondary" htmlFor="source-label">
                Source tag (helps the Distress Signal Analyst know where this came from)
              </label>
              <Input
                id="source-label"
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                placeholder="manual_import"
                className="max-w-md text-sm"
              />
              <div className="text-xs text-ink-muted">
                Common values: <code>propstream</code>, <code>batchdata</code>,{" "}
                <code>reisift</code>, <code>manual_import</code>.
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  "Import leads"
                )}
              </Button>
              <Button variant="outline" onClick={reset} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card
          className={
            result.imported > 0
              ? "border-state-success/40 bg-state-success/5"
              : "border-state-warning/40 bg-state-warning/5"
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              {result.imported > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-state-success" />
              ) : (
                <XCircle className="h-5 w-5 text-state-warning" />
              )}
              Import {result.imported > 0 ? "complete" : "finished with issues"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>{result.message}</div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border border-line-subtle bg-bg-surface p-3">
                <div className="font-mono text-2xl font-medium text-white">{result.imported}</div>
                <div className="text-xs text-ink-muted">Imported</div>
              </div>
              <div className="rounded-md border border-line-subtle bg-bg-surface p-3">
                <div className="font-mono text-2xl font-medium text-white">
                  {result.signalsCreated}
                </div>
                <div className="text-xs text-ink-muted">Signals attached</div>
              </div>
              <div className="rounded-md border border-line-subtle bg-bg-surface p-3">
                <div className="font-mono text-2xl font-medium text-state-warning">
                  {result.errors.length}
                </div>
                <div className="text-xs text-ink-muted">Rows skipped</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <details className="rounded-md border border-line-subtle bg-bg-surface p-3 text-xs">
                <summary className="cursor-pointer text-ink-secondary hover:text-white">
                  View {result.errors.length} skipped row{result.errors.length === 1 ? "" : "s"}
                </summary>
                <div className="mt-2 max-h-64 space-y-1 overflow-y-auto font-mono">
                  {result.errors.slice(0, 100).map((e, i) => (
                    <div key={i} className="text-ink-muted">
                      Row {e.rowNumber}: {e.message}
                    </div>
                  ))}
                  {result.errors.length > 100 && (
                    <div className="text-ink-muted">
                      … and {result.errors.length - 100} more.
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Import another file
              </Button>
              {result.imported > 0 && (
                <Button asChild variant="default" size="sm">
                  <a href={`/admin/businesses/${businessId}`}>View pipeline</a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
