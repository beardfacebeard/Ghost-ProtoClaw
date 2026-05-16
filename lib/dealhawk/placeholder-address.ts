/**
 * Placeholder-address detection.
 *
 * Some county scrapers (Maricopa is the canonical example — recorder
 * docs reference a parcel by APN, not by street address) emit records
 * with a placeholder propertyAddress like "(see APN via assessor join)".
 * Until an assessor-join enrichment step fills in the real address,
 * these rows should NOT flow to:
 *   - the field-visit candidate list (Google Maps URL renders garbage)
 *   - the outreach flow (Lob will reject)
 *   - the skip-trace flow (Smarty will fail)
 *
 * The sweep persists these rows with `enrichmentStatus: "needs_address"`
 * so they're visible to the operator + a future enrichment step but
 * gated out of action surfaces.
 */

const PLACEHOLDER_PREFIXES = ["(", "[", "{", "<"];
const PLACEHOLDER_CONTAINS = [
  "see apn",
  "see assessor",
  "see parcel",
  "needs enrichment",
  "needs lookup",
  "tbd",
  "to be determined",
  "address unknown",
  "no address"
];

export function isPlaceholderAddress(raw: string | null | undefined): boolean {
  if (!raw) return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (PLACEHOLDER_PREFIXES.includes(trimmed[0])) return true;
  const lower = trimmed.toLowerCase();
  for (const needle of PLACEHOLDER_CONTAINS) {
    if (lower.includes(needle)) return true;
  }
  // A real US address has at least one digit (house number) AND at least
  // one alphabetic character (street name). "12345" alone is not enough.
  const hasDigit = /[0-9]/.test(trimmed);
  const hasAlpha = /[a-zA-Z]{3,}/.test(trimmed);
  if (!hasDigit || !hasAlpha) return true;
  return false;
}
