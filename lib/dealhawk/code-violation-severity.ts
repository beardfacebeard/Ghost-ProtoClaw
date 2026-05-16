/**
 * Dealhawk Code Violation Module — Severity Classification Dictionary.
 *
 * Most code-enforcement feeds don't ship with a severity field. This
 * library classifies each record into a tier (1=extreme, 2=strong,
 * 3=moderate, 4=low) by composing four signals:
 *
 *   1. City-specific violation-code prefix match (per-city dictionary).
 *   2. Keyword match against the violation description.
 *   3. Case age (cases open >180 days bump tier).
 *   4. Operator override (stored per record).
 *
 * Plan §5: violation severity is the single biggest data-quality gap
 * across the 250-500 cities with open code-violation data, because most
 * feeds give you a violation code (e.g. "ICC 304.1") but no severity.
 * This dictionary covers the 10 Tier-1 launch cities; cities added via
 * the generic Socrata/ArcGIS adapter (Tier 2) default to "moderate"
 * until the operator builds out a per-city dictionary or overrides
 * per record.
 */

export type SeverityTier = 1 | 2 | 3 | 4;

export type SeverityClassificationInput = {
  /** Source-specific violation code (e.g. "CN130070" Chicago). */
  violationCode?: string | null;
  /** Free-text violation description from the source. */
  violationDescription: string;
  /** When the case was filed; used for age-based tier bump. */
  filingDate: Date;
  /** Lowercase city name — used to pick the right per-city dictionary. */
  city: string;
  /** 2-letter USPS state code. */
  state: string;
  /** Operator-provided override; bypasses all heuristics. */
  operatorOverride?: SeverityTier | null;
};

export type SeverityClassificationResult = {
  tier: SeverityTier;
  /** "operator_override" | "city_dictionary" | "keyword" | "default" */
  source: string;
  /** Human-readable rationale for the dashboard. */
  reasoning: string;
};

// ── Per-city code prefix dictionary ──────────────────────────────────
// Each entry maps a per-city violation-code prefix to a tier. The
// runner picks the LONGEST matching prefix to support code hierarchies
// (e.g. "CN130" → tier 2, but "CN13007" → tier 1).

type CityCodeMap = Record<string, SeverityTier>;

/**
 * Chicago Building Violations — code prefix CN1xxxx with sub-codes
 * indicating the violation type. CN13xxxx = unsafe / dangerous;
 * CN18xxxx = property maintenance (overgrown / debris); CN03xxxx =
 * required permits.
 */
const CHICAGO_CODES: CityCodeMap = {
  CN13: 1, // Unsafe / dangerous
  CN18: 3, // Property maintenance
  CN03: 3, // Permits
  CN10: 2, // Structural
  CN15: 2 // Fire safety
};

/**
 * NYC HPD (Housing Maintenance Code). Class is explicit in the feed:
 * "C" = immediately hazardous, "B" = hazardous, "A" = non-hazardous.
 * We classify by `class` field rather than code prefix.
 */
const NYC_HPD_CLASS_MAP: Record<string, SeverityTier> = {
  C: 1, // Immediately hazardous
  B: 2, // Hazardous
  A: 3, // Non-hazardous
  I: 4 // Information only
};

/**
 * NYC DOB (Department of Buildings). DOB violation classes:
 * Z = Major hazardous; A = Class 1; B = Class 2; LL = local-law.
 */
const NYC_DOB_CLASS_MAP: Record<string, SeverityTier> = {
  Z: 1, // Major hazardous
  A: 2, // Class 1
  B: 3, // Class 2
  LL: 3 // Local law
};

/**
 * LA Building & Safety. Severity inferred from case type:
 * "Order to Comply - Substandard" = tier 1; "Order to Comply" = tier 2;
 * "Notice of Inspection" = tier 4.
 */
const LA_CODES: CityCodeMap = {
  SUBSTANDARD: 1,
  ORDER_TO_COMPLY: 2,
  NOTICE_TO_COMPLY: 3,
  NOTICE_OF_INSPECTION: 4
};

/**
 * Philadelphia L&I. Violation codes prefixed by section (PM-* for
 * property maintenance, BC-* for building code, FC-* for fire code).
 * Severity inferred from keywords in description + LI's case_status.
 */
const PHILLY_PREFIXES: CityCodeMap = {
  PM: 3, // Property maintenance
  BC: 2, // Building code
  FC: 2, // Fire code
  ZP: 3 // Zoning
};

/**
 * SF DBI. SF uses Notice of Violation (NOV) categorized by section.
 * "Substandard" / "Unsafe" / "Order of Abatement" = tier 1.
 */
const SF_CODES: CityCodeMap = {
  SUBSTANDARD: 1,
  UNSAFE: 1,
  ABATEMENT_ORDER: 1,
  NOV: 3, // Generic Notice of Violation
  COMPLAINT: 4
};

/**
 * Detroit Blight Violations. Detroit ticket categories are well-defined:
 * "Dangerous Buildings" = tier 1; "Property Maintenance" = tier 3.
 */
const DETROIT_CODES: CityCodeMap = {
  DANGEROUS_BUILDINGS: 1,
  DEMOLITION_ORDER: 1,
  PROPERTY_MAINT: 3,
  RUBBISH_TIRES: 3,
  BLIGHT_TICKET: 3
};

/**
 * Cincinnati Code Enforcement.
 */
const CINCINNATI_CODES: CityCodeMap = {
  UNSAFE: 1,
  CONDEMNED: 1,
  MAINTENANCE: 3,
  ZONING: 3
};

/**
 * Columbus OH Code Enforcement.
 */
const COLUMBUS_CODES: CityCodeMap = {
  CONDEMN: 1,
  UNSAFE: 1,
  STRUCTURAL: 2,
  EXTERIOR: 3,
  WEEDS: 3
};

/**
 * Baltimore County Vacants. Vacant-property registry is a Tier-2
 * baseline (vacancy = strong distress); add Tier-1 for "boarded" or
 * "open and accessible".
 */
const BALTIMORE_COUNTY_VACANT_BASELINE: SeverityTier = 2;

const CITY_DICTIONARIES: Record<string, CityCodeMap> = {
  "chicago,il": CHICAGO_CODES,
  "los angeles,ca": LA_CODES,
  "philadelphia,pa": PHILLY_PREFIXES,
  "san francisco,ca": SF_CODES,
  "detroit,mi": DETROIT_CODES,
  "cincinnati,oh": CINCINNATI_CODES,
  "columbus,oh": COLUMBUS_CODES
};

// ── Keyword classifiers ──────────────────────────────────────────────
// Run after the city-dictionary check (when no match). Keyword matches
// in the violation description bump severity. Most-restrictive (highest
// tier) wins.

const TIER_1_KEYWORDS = [
  /\bunsafe\b/i,
  /\bcondemned?\b/i,
  /\bdemolition\b/i,
  /\bdangerous\b/i,
  /\bcollapse\b/i,
  /\bfire damage\b/i,
  /\bstructural failure\b/i,
  /\bopen and (?:vacant|accessible)\b/i,
  /\bboarded (?:up|window|door)\b/i,
  /\bimminent(?:ly)? hazard/i
];

const TIER_2_KEYWORDS = [
  /\bstructural\b/i,
  /\broof damage\b/i,
  /\bwater damage\b/i,
  /\bvacant\b/i,
  /\babandoned\b/i,
  /\bfailure to repair\b/i,
  /\brepeat\b/i
];

const TIER_3_KEYWORDS = [
  /\bovergrown\b/i,
  /\bweeds?\b/i,
  /\bjunk\b/i,
  /\bdebris\b/i,
  /\brubbish\b/i,
  /\babandoned vehicle\b/i,
  /\billegal dumping\b/i,
  /\bbroken window\b/i,
  /\bproperty maintenance\b/i
];

// ── Public API ───────────────────────────────────────────────────────

function cityKey(city: string, state: string): string {
  return `${city.trim().toLowerCase()},${state.trim().toLowerCase()}`;
}

function pickLongestPrefix(
  dict: CityCodeMap,
  code: string
): SeverityTier | null {
  const upper = code.toUpperCase();
  let best: { len: number; tier: SeverityTier } | null = null;
  for (const [prefix, tier] of Object.entries(dict)) {
    if (upper.startsWith(prefix) && (!best || prefix.length > best.len)) {
      best = { len: prefix.length, tier };
    }
  }
  return best?.tier ?? null;
}

function classifyByKeyword(description: string): SeverityTier | null {
  if (TIER_1_KEYWORDS.some((re) => re.test(description))) return 1;
  if (TIER_2_KEYWORDS.some((re) => re.test(description))) return 2;
  if (TIER_3_KEYWORDS.some((re) => re.test(description))) return 3;
  return null;
}

function ageBumpTier(filingDate: Date, currentTier: SeverityTier): SeverityTier {
  const ageDays = (Date.now() - filingDate.getTime()) / (24 * 60 * 60 * 1000);
  // Cases open >180 days are an operator-indifference signal; bump
  // by one tier (capped at 1).
  if (ageDays > 180 && currentTier > 1) {
    return (currentTier - 1) as SeverityTier;
  }
  return currentTier;
}

export function classifySeverity(
  input: SeverityClassificationInput
): SeverityClassificationResult {
  // 1. Operator override wins.
  if (input.operatorOverride) {
    return {
      tier: input.operatorOverride,
      source: "operator_override",
      reasoning: "Operator-set tier"
    };
  }

  // 2. City dictionary.
  const dict = CITY_DICTIONARIES[cityKey(input.city, input.state)];
  if (dict && input.violationCode) {
    const tier = pickLongestPrefix(dict, input.violationCode);
    if (tier !== null) {
      const final = ageBumpTier(input.filingDate, tier);
      return {
        tier: final,
        source: "city_dictionary",
        reasoning: `Matched ${input.city}, ${input.state} prefix "${input.violationCode}" → tier ${tier}${
          final !== tier ? ` (bumped to ${final} for case age >180d)` : ""
        }`
      };
    }
  }

  // 3. NYC HPD class field — special case (passed via violationCode).
  if (
    cityKey(input.city, input.state) === "new york,ny" &&
    input.violationCode &&
    NYC_HPD_CLASS_MAP[input.violationCode.toUpperCase()]
  ) {
    const tier = NYC_HPD_CLASS_MAP[input.violationCode.toUpperCase()];
    const final = ageBumpTier(input.filingDate, tier);
    return {
      tier: final,
      source: "city_dictionary",
      reasoning: `NYC HPD class "${input.violationCode}" → tier ${tier}${
        final !== tier ? ` (age-bumped to ${final})` : ""
      }`
    };
  }

  // 4. Baltimore County vacant baseline.
  if (cityKey(input.city, input.state) === "baltimore,md") {
    return {
      tier: ageBumpTier(input.filingDate, BALTIMORE_COUNTY_VACANT_BASELINE),
      source: "city_dictionary",
      reasoning: "Baltimore County vacant registry baseline = tier 2"
    };
  }

  // 5. Keyword fallback.
  const keywordTier = classifyByKeyword(input.violationDescription);
  if (keywordTier !== null) {
    const final = ageBumpTier(input.filingDate, keywordTier);
    return {
      tier: final,
      source: "keyword",
      reasoning: `Matched keyword pattern in description → tier ${keywordTier}${
        final !== keywordTier ? ` (age-bumped to ${final})` : ""
      }`
    };
  }

  // 6. Default — "moderate" (tier 3) when nothing else fires. Cities
  // added via generic adapter without a custom dictionary land here
  // until the operator overrides per record.
  return {
    tier: ageBumpTier(input.filingDate, 3),
    source: "default",
    reasoning:
      "No city dictionary or keyword match — defaulted to tier 3 (moderate). Operator can override per record."
  };
}

/**
 * Returns the human-readable tier label for the dashboard.
 */
export function severityTierLabel(tier: SeverityTier): string {
  switch (tier) {
    case 1:
      return "Extreme distress";
    case 2:
      return "Strong distress";
    case 3:
      return "Moderate distress";
    case 4:
      return "Low signal";
  }
}
