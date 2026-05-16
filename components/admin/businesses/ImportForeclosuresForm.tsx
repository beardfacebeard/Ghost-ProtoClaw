"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type Props = {
  businessId: string;
  businessName: string;
};

type ImportResponse = {
  imported: number;
  duplicatesSkipped: number;
  errors: Array<{ rowNumber: number; message: string }>;
  message: string;
  error?: string;
};

const MAX_FILE_SIZE_MB = 5;

export function ImportForeclosuresForm({ businessId, businessName }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [sourceType, setSourceType] = useState("csv_import");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Max ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setFileName(file.name);
    setCsvText(await file.text());
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
        `/api/admin/businesses/${businessId}/foreclosures/import`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            csv: csvText,
            sourceType: sourceType.trim() || "csv_import"
          })
        }
      );
      const payload = (await response.json()) as ImportResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? payload.message ?? "Import failed.");
      }
      setResult(payload);
      if (payload.imported > 0) {
        toast.success(
          `${payload.imported} foreclosure record${
            payload.imported === 1 ? "" : "s"
          } imported into ${businessName}.`
        );
        router.refresh();
      } else {
        toast.error(
          "No rows imported. Check the error list — common causes: missing propertyAddress / county / state / ownerName / filingDate / foreclosureStage."
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
    setResult(null);
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
                Max {MAX_FILE_SIZE_MB} MB · up to 1,000 rows per upload · PropStream / county-direct
                / paralegal exports work
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md border border-line-subtle bg-bg-surface-2/40 p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-steel" />
                <div className="text-sm">
                  <div className="font-medium text-white">{fileName ?? "Pasted CSV"}</div>
                  <div className="text-xs text-ink-muted">
                    {(csvText.length / 1024).toFixed(1)} KB · ~
                    {csvText.split("\n").length - 1} rows
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
                setFileName(null);
              }}
              placeholder="propertyAddress,county,state,ownerName,filingDate,foreclosureStage,caseNumber,auctionDate,trusteeName,lenderName,reinstatementAmount&#10;123 Main St,Maricopa,AZ,John Smith,2026-04-15,Notice of Default,,,FIRST AMERICAN TRUSTEE,WELLS FARGO,$12500"
              className="font-mono text-xs"
            />
          </details>

          <div className="space-y-2 text-xs">
            <label className="text-ink-muted">Source label (optional)</label>
            <input
              type="text"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              placeholder="csv_import / propstream / county_recorder_manual"
              className="w-full rounded-md border border-line-subtle bg-bg-surface-2/40 px-3 py-2 font-mono text-xs text-white placeholder:text-ink-muted/60"
            />
            <p className="text-ink-muted">
              Stored on each record as sourceType so the operator can later filter ATTOM-fed vs
              CSV-uploaded vs county-direct records.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">2. Required columns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-ink-muted">
          <p>
            Column names are matched case-insensitively with common aliases. Required:
            <span className="font-mono text-white">
              {" "}
              propertyAddress / county / state / ownerName / filingDate / foreclosureStage
            </span>
            .
          </p>
          <p>
            Optional but recommended:
            <span className="font-mono">
              {" "}
              apn, ownerMailingAddress, auctionDate, caseNumber, trusteeName, lenderName,
              plaintiffAttorney, reinstatementAmount, judgmentAmount, sourceUrl, sourceDocumentUrl
            </span>
            .
          </p>
          <p>
            <span className="font-mono">foreclosureStage</span> accepts: NOD / Notice of Default /
            NOTS / Notice of Trustee Sale / LP / Lis Pendens / Judgment / Notice of Sale / Sheriff
            Sale.
          </p>
        </CardContent>
      </Card>

      <Card className="border-line-subtle bg-bg-surface">
        <CardHeader>
          <CardTitle className="text-base text-white">3. Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleSubmit} disabled={submitting || !csvText.trim()}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              "Import foreclosure records"
            )}
          </Button>

          {result ? (
            <div className="space-y-2 rounded-md border border-line-subtle bg-bg-surface-2/40 p-3 text-xs">
              <div className="font-medium text-white">{result.message}</div>
              {result.duplicatesSkipped > 0 ? (
                <div className="text-ink-muted">
                  {result.duplicatesSkipped} duplicate
                  {result.duplicatesSkipped === 1 ? "" : "s"} skipped (matching businessId +
                  sourceType + sourceUrl + filingDate already on file).
                </div>
              ) : null}
              {result.errors.length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-ink-muted hover:text-white">
                    {result.errors.length} row error
                    {result.errors.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 space-y-1 font-mono text-ink-muted">
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        row {e.rowNumber}: {e.message}
                      </li>
                    ))}
                    {result.errors.length > 20 ? (
                      <li>…and {result.errors.length - 20} more</li>
                    ) : null}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
