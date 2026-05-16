/**
 * Florida Public Notices (floridapublicnotices.com) — state-aggregator scraper.
 *
 * The Florida Press Association aggregates legal notices including
 * foreclosure-related publications from member newspapers across the
 * state. This scraper uses Firecrawl to fetch the search results page
 * + extract foreclosure-typed notices.
 *
 * Friction notes (verify before launch):
 *   - Not every county newspaper participates; coverage is best in
 *     larger MSAs.
 *   - Search-results HTML structure has been stable but unverified
 *     post-2025 redesign. If the parser confidence drops below 0.5 on
 *     repeated runs, surface to the operator + fall back to ATTOM /
 *     direct scraping for affected counties.
 *   - Operator must verify floridapublicnotices.com's TOS before
 *     scraping at scale. Aggressive rate-limit (1 req / 5 seconds
 *     default) reduces friction.
 */

import type {
  CountyScraper,
  ScraperContext,
  ScraperResult,
  ScrapedForeclosureRecord
} from "./types";

const FIRECRAWL_BASE = "https://api.firecrawl.dev";

async function firecrawlExtract(
  apiKey: string,
  url: string
): Promise<{ ok: boolean; data: { markdown?: string; html?: string; metadata?: Record<string, unknown> } }> {
  const res = await fetch(`${FIRECRAWL_BASE}/v1/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true
    })
  });
  if (!res.ok) {
    return { ok: false, data: {} };
  }
  const body = (await res.json().catch(() => ({}))) as {
    data?: { markdown?: string; html?: string; metadata?: Record<string, unknown> };
  };
  return { ok: true, data: body.data ?? {} };
}

/**
 * Parse a Firecrawl-extracted markdown page into structured foreclosure
 * records. The aggregator publishes one notice per "section" — title
 * line, newspaper attribution, publication date, body text. We pull the
 * fields that consistently appear; missing fields land as undefined.
 */
function parseFloridaNoticesMarkdown(
  markdown: string,
  sourceUrl: string
): ScrapedForeclosureRecord[] {
  const records: ScrapedForeclosureRecord[] = [];
  // Notices typically separated by horizontal rules or repeated empty
  // lines. Split conservatively.
  const blocks = markdown.split(/\n\s*\n\s*\n/);
  for (const block of blocks) {
    if (block.length < 80) continue;
    // Filter to foreclosure-related notices.
    if (
      !/notice of (sale|action|default|trustee'?s? sale|foreclosure)/i.test(block) &&
      !/(mortgage foreclosure|lis pendens)/i.test(block)
    ) {
      continue;
    }
    const propMatch = block.match(/(?:property\s+(?:at|address)|premises|known as)[:\s]+(.+?)(?:\.|;|,\s*[A-Z]{2})/i);
    const propertyAddress = propMatch?.[1]?.trim();
    if (!propertyAddress) continue;
    const ownerMatch = block.match(/(?:defendant|borrower|owner|grantor|mortgagor)[:\s]+([A-Z][A-Z\s\.\-']+)/);
    const ownerName = ownerMatch?.[1]?.trim();
    if (!ownerName) continue;
    const countyMatch = block.match(/in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*?)\s+County/i);
    const county = countyMatch?.[1] ?? "";
    const dateMatch = block.match(/dated\s+(?:this\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+(?:day\s+of\s+)?[A-Z][a-z]+\,?\s+\d{4})/i);
    const auctionMatch = block.match(/(?:sale\s+(?:date|will be held)|to be sold on)[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i);
    const caseMatch = block.match(/case\s*(?:no\.?|number|#)[:\s]*([A-Z0-9-]+)/i);
    const lenderMatch = block.match(/(?:plaintiff|lender|beneficiary)[:\s]+([A-Z][A-Z\s\.\-,]+)/);

    let filingDate: Date | null = null;
    if (dateMatch) {
      const parsed = new Date(dateMatch[1].replace(/(\d+)(?:st|nd|rd|th)/, "$1"));
      if (!Number.isNaN(parsed.getTime())) filingDate = parsed;
    }
    if (!filingDate) filingDate = new Date();

    const auctionDate =
      auctionMatch && !Number.isNaN(new Date(auctionMatch[1]).getTime())
        ? new Date(auctionMatch[1])
        : undefined;

    const stage = /trustee'?s? sale/i.test(block)
      ? "notice_of_trustee_sale"
      : /lis pendens/i.test(block)
        ? "lis_pendens"
        : /default/i.test(block)
          ? "notice_of_default"
          : "notice_of_sale";
    const documentType =
      stage === "notice_of_default"
        ? "NOD"
        : stage === "lis_pendens"
          ? "LP"
          : stage === "notice_of_trustee_sale"
            ? "NOTS"
            : "NS";

    records.push({
      propertyAddress,
      county,
      state: "FL",
      ownerName,
      foreclosureStage: stage,
      documentType,
      filingDate,
      auctionDate,
      caseNumber: caseMatch?.[1],
      lenderName: lenderMatch?.[1]?.trim(),
      sourceUrl,
      sourceDocumentUrl: sourceUrl,
      parserConfidence: 0.55,
      parserRawText: block.slice(0, 4000)
    });
  }
  return records;
}

export const floridaLegalNoticesScraper: CountyScraper = {
  id: "fl-legal-notices",
  label: "Florida Public Notices (aggregator)",
  kind: "state_legal_notice",
  states: ["FL"],
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
    const warnings: string[] = [];
    const results: ScrapedForeclosureRecord[] = [];
    // Pull the foreclosure-category search results. Limit to one page
    // per run; pagination is a follow-up.
    const url =
      "https://www.floridapublicnotices.com/search/?category=foreclosure";
    try {
      const { ok, data } = await firecrawlExtract(apiKey, url);
      if (!ok || !data.markdown) {
        return {
          ok: false,
          error: "Firecrawl returned no markdown for floridapublicnotices.com",
          retryable: true
        };
      }
      const parsed = parseFloridaNoticesMarkdown(data.markdown, url);
      const sinceDate = new Date(ctx.sinceFilingDate);
      for (const rec of parsed) {
        if (rec.filingDate < sinceDate) continue;
        if (results.length >= ctx.maxRecords) break;
        results.push(rec);
      }
      if (parsed.length === 0) {
        warnings.push(
          "Parser returned 0 records from floridapublicnotices.com — may indicate a layout change. Verify before next run."
        );
      }
      return { ok: true, records: results, warnings };
    } catch (err) {
      return {
        ok: false,
        error: `florida-legal-notices fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true
      };
    }
  }
};
