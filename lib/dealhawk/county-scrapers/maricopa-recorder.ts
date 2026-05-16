/**
 * Maricopa County AZ Recorder — county_recorder scraper.
 *
 * Maricopa publishes Notice of Trustee Sale (NOTS) + Notice of Default
 * (NOD) filings via recorder.maricopa.gov/recording/document-search.html.
 * Document search is free; image downloads carry a per-page fee. We
 * pull the index page + extract row-level filings.
 *
 * Coverage caveats:
 *   - Online search is capped at the last 2 years (verified 2026-05).
 *   - Result pages are paginated; this v1 scraper pulls page 1 only.
 *   - Property address is often missing from the index — we capture the
 *     trustor name + recording date + document type + APN where present,
 *     and downstream enrichment (Regrid/ATTOM) fills in the address.
 *
 * Operator must verify the recorder's TOS before scraping at scale.
 * Aggressive rate-limit (1 req / 5 seconds) reduces friction.
 */

import type {
  CountyScraper,
  ScraperContext,
  ScraperResult,
  ScrapedForeclosureRecord
} from "./types";

const FIRECRAWL_BASE = "https://api.firecrawl.dev";

async function firecrawlScrape(
  apiKey: string,
  url: string
): Promise<{ ok: boolean; markdown: string; raw: Record<string, unknown> }> {
  const res = await fetch(`${FIRECRAWL_BASE}/v1/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      // The recorder portal sets a UA filter — identify as a bot
      // honestly rather than masking, to stay on the right side of
      // anti-scraping policies.
      headers: { "User-Agent": "GhostProtoClaw/1.0 (Dealhawk dealhawk@ghostprotoclaw.com)" }
    })
  });
  if (!res.ok) return { ok: false, markdown: "", raw: {} };
  const body = (await res.json().catch(() => ({}))) as {
    data?: { markdown?: string; metadata?: Record<string, unknown> };
  };
  return {
    ok: true,
    markdown: body.data?.markdown ?? "",
    raw: body.data?.metadata ?? {}
  };
}

// Maricopa document codes for foreclosure-relevant filings.
const DOC_CODES = ["NTS", "NOD", "NOTS"];

function parseMaricopaMarkdown(
  markdown: string,
  sourceUrl: string
): ScrapedForeclosureRecord[] {
  const records: ScrapedForeclosureRecord[] = [];
  const lines = markdown.split(/\r?\n/);
  // The result rows typically look like:
  //   YYYYMMDD  20251234567  NOTS  TRUSTOR_NAME, FIRST  BENEFICIARY...
  // Be tolerant about whitespace + extra columns; require a recognizable
  // document code + a date.
  for (const line of lines) {
    const docCodeMatch = line.match(
      /\b(20\d{6})\s+(\d{8,})\s+(NTS|NOD|NOTS)\b/
    );
    if (!docCodeMatch) continue;
    const [, dateRaw, docNum, code] = docCodeMatch;
    if (!DOC_CODES.includes(code)) continue;

    const filingDate = new Date(
      `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}T00:00:00Z`
    );
    if (Number.isNaN(filingDate.getTime())) continue;

    // After the doc code, the rest of the line typically has name fields.
    // Grab whatever's there as raw text; downstream parser cleans it up.
    const rest = line.slice(line.indexOf(code) + code.length).trim();
    const nameMatch = rest.match(/^([A-Z][A-Z\s,\.\-']+?)(?:\s{2,}|$)/);
    const ownerName = nameMatch?.[1]?.trim() || rest.split(/\s{2,}/)[0]?.trim() || "(unknown)";
    if (ownerName === "(unknown)") continue;

    const stage = code === "NOD" ? "notice_of_default" : "notice_of_trustee_sale";
    const documentType = code === "NOTS" ? "NOTS" : code;

    records.push({
      propertyAddress: "(see APN via assessor join)",
      county: "Maricopa",
      state: "AZ",
      ownerName,
      foreclosureStage: stage,
      documentType,
      filingDate,
      sourceUrl,
      // Recording-doc images are paywalled at $1-5/page; capture the
      // search-result URL only.
      sourceDocumentUrl: undefined,
      parserConfidence: 0.6,
      parserRawText: `Doc# ${docNum} | code ${code} | raw: ${line.trim().slice(0, 500)}`
    });
  }
  return records;
}

export const maricopaRecorderScraper: CountyScraper = {
  id: "maricopa-az-recorder",
  label: "Maricopa County, AZ Recorder",
  kind: "county_recorder",
  states: ["AZ"],
  counties: ["Maricopa"],
  requiresCredentials: ["firecrawl"],
  async run(ctx: ScraperContext): Promise<ScraperResult> {
    const apiKey = ctx.credentials.firecrawl?.api_key;
    if (!apiKey) {
      return {
        ok: false,
        error: "Firecrawl API key not configured.",
        retryable: false
      };
    }
    const today = new Date();
    const since = new Date(ctx.sinceFilingDate);
    // Query the last 30 days by default (Maricopa caps at 2yr; we
    // pick a conservative recent window per run).
    const queryStart = new Date(
      Math.max(today.getTime() - 30 * 24 * 60 * 60 * 1000, since.getTime())
    );
    const startStr = `${queryStart.getFullYear()}${String(queryStart.getMonth() + 1).padStart(2, "0")}${String(queryStart.getDate()).padStart(2, "0")}`;
    const endStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    // Public search endpoint pattern. Document type 30 = NTS (verify
    // per recorder's current code table before launch).
    const url = `https://recorder.maricopa.gov/recdocdata/GetRecDataResult.aspx?d1=${startStr}&d2=${endStr}&doc=NTS,NOD&recordoffset=0`;
    try {
      const { ok, markdown } = await firecrawlScrape(apiKey, url);
      if (!ok || !markdown) {
        return {
          ok: false,
          error: "Firecrawl returned no markdown for Maricopa recorder",
          retryable: true
        };
      }
      const records = parseMaricopaMarkdown(markdown, url);
      const filtered = records
        .filter((r) => r.filingDate >= since)
        .slice(0, ctx.maxRecords);
      const warnings: string[] = [];
      if (records.length === 0) {
        warnings.push(
          "Maricopa parser returned 0 records — verify the portal URL is current + the document codes haven't changed."
        );
      }
      return { ok: true, records: filtered, warnings };
    } catch (err) {
      return {
        ok: false,
        error: `maricopa-recorder fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true
      };
    }
  }
};
