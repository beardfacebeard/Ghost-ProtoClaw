/**
 * Dallas County TX Clerk — county_recorder scraper for Notice of
 * Trustee Sale (NOTS) filings.
 *
 * Texas Property Code requires county websites to publish NOTS filings
 * for free, in a stable HTML format. Dallas County publishes a
 * monthly-rolling list at dallascounty.org/government/county-clerk/
 * recording/foreclosures.php. NOTS filings include trustor, beneficiary
 * (lender), trustee, auction date, property legal description.
 *
 * Coverage caveats:
 *   - NOTS only — Texas is non-judicial, so NOD is rare in the recorder
 *     feed; NOTS is the auction notice (21-day lead time).
 *   - Property address is via legal description — assessor join needed
 *     for street address.
 *   - Auction-imminent leads only (21-day lead time means most NOTS
 *     records are too late for soft-touch acquisition).
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
): Promise<{ ok: boolean; markdown: string }> {
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
      headers: { "User-Agent": "GhostProtoClaw/1.0 (Dealhawk dealhawk@ghostprotoclaw.com)" }
    })
  });
  if (!res.ok) return { ok: false, markdown: "" };
  const body = (await res.json().catch(() => ({}))) as {
    data?: { markdown?: string };
  };
  return { ok: true, markdown: body.data?.markdown ?? "" };
}

function parseDallasMarkdown(
  markdown: string,
  sourceUrl: string
): ScrapedForeclosureRecord[] {
  const records: ScrapedForeclosureRecord[] = [];
  // Dallas NOTS entries typically contain "SUBSTITUTE TRUSTEE'S SALE" +
  // a list of fields. Look for blocks with that marker.
  const blocks = markdown.split(/(?=SUBSTITUTE\s+TRUSTEE'?S?\s+SALE|NOTICE\s+OF\s+(?:SUBSTITUTE\s+)?TRUSTEE'?S?\s+SALE)/i);
  for (const block of blocks) {
    if (!/TRUSTEE'?S?\s+SALE/i.test(block)) continue;
    if (block.length < 200) continue;

    const trustorMatch = block.match(/(?:trustor|borrower|grantor)[:\s]+([A-Z][A-Z\s,\.\-']+)(?:\n|$)/i);
    const beneficiaryMatch = block.match(/(?:beneficiary|lender|plaintiff)[:\s]+([A-Z][A-Z\s,\.\-]+)(?:\n|$)/i);
    const trusteeMatch = block.match(/(?:substitute\s+trustee|trustee)[:\s]+([A-Z][A-Z\s,\.\-']+)(?:\n|$)/i);
    const dateMatch = block.match(/(?:date\s+of\s+sale|sale\s+date|first\s+tuesday)[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
    const filingMatch = block.match(/(?:filed|recorded|dated)\s+(?:on\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
    const propMatch = block.match(/(?:property\s+(?:located\s+)?at|premises)[:\s]+(.+?)(?:\.|,\s*Dallas\s+County)/i);

    const ownerName = trustorMatch?.[1]?.trim();
    if (!ownerName) continue;

    const filingDate = filingMatch
      ? new Date(filingMatch[1])
      : new Date();
    if (Number.isNaN(filingDate.getTime())) continue;
    const auctionDate = dateMatch ? new Date(dateMatch[1]) : undefined;

    records.push({
      propertyAddress: propMatch?.[1]?.trim() || "(see legal description in source doc)",
      county: "Dallas",
      state: "TX",
      ownerName,
      foreclosureStage: "notice_of_trustee_sale",
      documentType: "NOTS",
      filingDate,
      auctionDate:
        auctionDate && !Number.isNaN(auctionDate.getTime()) ? auctionDate : undefined,
      lenderName: beneficiaryMatch?.[1]?.trim(),
      trusteeName: trusteeMatch?.[1]?.trim(),
      sourceUrl,
      sourceDocumentUrl: sourceUrl,
      parserConfidence: 0.65,
      parserRawText: block.slice(0, 4000)
    });
  }
  return records;
}

export const dallasClerkScraper: CountyScraper = {
  id: "dallas-tx-clerk",
  label: "Dallas County, TX County Clerk",
  kind: "county_recorder",
  states: ["TX"],
  counties: ["Dallas"],
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
    const url =
      "https://www.dallascounty.org/government/county-clerk/recording/foreclosures.php";
    try {
      const { ok, markdown } = await firecrawlScrape(apiKey, url);
      if (!ok || !markdown) {
        return {
          ok: false,
          error: "Firecrawl returned no markdown for Dallas clerk foreclosure page",
          retryable: true
        };
      }
      const records = parseDallasMarkdown(markdown, url);
      const since = new Date(ctx.sinceFilingDate);
      const filtered = records
        .filter((r) => r.filingDate >= since)
        .slice(0, ctx.maxRecords);
      const warnings: string[] = [];
      if (records.length === 0) {
        warnings.push(
          "Dallas parser returned 0 records — verify the foreclosure page URL is current + the parse markers haven't changed."
        );
      }
      return { ok: true, records: filtered, warnings };
    } catch (err) {
      return {
        ok: false,
        error: `dallas-clerk fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true
      };
    }
  }
};
