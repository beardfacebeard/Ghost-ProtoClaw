/**
 * Pre-built Tier-1 city scrapers for the Code Violation module.
 *
 * Each city below is a `CodeScraper` instance configured against the
 * city's specific dataset URL + field map. Most are built via the
 * generic Socrata or ArcGIS adapter factory; a couple (Philadelphia
 * Carto, NYC HPD with class field, Detroit blight) need light
 * city-specific tuning.
 *
 * The 10 launch cities cover roughly 35% of the US urban housing
 * stock between them. Adding more is a matter of dropping another
 * factory call below + registering in registry.ts.
 *
 * Per the plan: operators get the BEST data quality from these
 * Tier-1 scrapers because the field map + severity dictionary are
 * hand-tuned. Cities added via the generic adapter (Tier 2) work
 * but default to "moderate" severity until the operator overrides.
 */

import type { CodeScraper } from "./types";
import { buildSocrataScraper } from "./generic-socrata";
import { buildArcgisScraper } from "./generic-arcgis";

// ── Chicago Building Violations ─────────────────────────────────────
// Socrata dataset 22u3-xenr. 2M+ records since 2006. Daily refresh.
// Code prefix CN13xxxx = unsafe; CN18xxxx = property maintenance.
export const chicagoBuildingViolations: CodeScraper = buildSocrataScraper({
  id: "chicago-building-violations",
  label: "Chicago Building Violations",
  city: "Chicago",
  state: "IL",
  endpointUrl: "https://data.cityofchicago.org/resource/22u3-xenr.json",
  fieldMap: {
    address: "address",
    description: "violation_description",
    violationCode: "violation_code",
    status: "violation_status",
    filingDate: "issued_date",
    lastActionDate: "violation_last_modified_date",
    caseNumber: "id"
  },
  openCasesWhere: "violation_status != 'CLOSED'"
});

// ── NYC HPD Violations ──────────────────────────────────────────────
// Socrata dataset wvxf-dwi5. NYC HPD ships a `class` field (A/B/C)
// which is the severity signal. We pass that as the violationCode so
// the severity dictionary's NYC_HPD_CLASS_MAP picks it up.
export const nycHpdViolations: CodeScraper = buildSocrataScraper({
  id: "nyc-hpd-violations",
  label: "NYC HPD Violations",
  city: "New York",
  state: "NY",
  endpointUrl: "https://data.cityofnewyork.us/resource/wvxf-dwi5.json",
  fieldMap: {
    address: "housenumber",
    description: "novdescription",
    // HPD class is the severity field; route it through violationCode
    // so classifySeverity's NYC_HPD_CLASS_MAP fires.
    violationCode: "class",
    status: "currentstatus",
    filingDate: "novissueddate",
    caseNumber: "violationid",
    ownerName: "ownername"
  },
  openCasesWhere: "currentstatus != 'CLOSE'"
});

// ── NYC DOB Violations ──────────────────────────────────────────────
// Socrata 3h2n-5cm9. Structural / construction violations.
export const nycDobViolations: CodeScraper = buildSocrataScraper({
  id: "nyc-dob-violations",
  label: "NYC DOB Violations",
  city: "New York",
  state: "NY",
  endpointUrl: "https://data.cityofnewyork.us/resource/3h2n-5cm9.json",
  fieldMap: {
    address: "house_number",
    description: "description",
    violationCode: "violation_category",
    status: "disposition_code",
    filingDate: "issue_date",
    caseNumber: "isn_dob_bis_viol"
  },
  // DOB disposition codes: blank/null = open; "A1"/"A2"/"R1" etc =
  // various resolution states.
  openCasesWhere: "disposition_code IS NULL OR disposition_code = ''"
});

// ── LA Building & Safety Code Enforcement ───────────────────────────
// Socrata 2uz8-3tj3. Case type field drives severity (Order to
// Comply - Substandard = tier 1).
export const laCodeEnforcement: CodeScraper = buildSocrataScraper({
  id: "la-code-enforcement",
  label: "LA Building & Safety Code Enforcement",
  city: "Los Angeles",
  state: "CA",
  endpointUrl: "https://data.lacity.org/resource/2uz8-3tj3.json",
  fieldMap: {
    address: "address",
    description: "case_type",
    status: "case_status",
    filingDate: "open_date",
    caseNumber: "case_number"
  },
  openCasesWhere: "case_status != 'Closed'",
  // LA encodes severity in case_type rather than a separate code.
  extractCode: (row) => {
    const ct = String(row.case_type ?? "").toUpperCase();
    if (ct.includes("SUBSTANDARD")) return "SUBSTANDARD";
    if (ct.includes("ORDER TO COMPLY")) return "ORDER_TO_COMPLY";
    if (ct.includes("NOTICE TO COMPLY")) return "NOTICE_TO_COMPLY";
    if (ct.includes("INSPECTION")) return "NOTICE_OF_INSPECTION";
    return undefined;
  }
});

// ── San Francisco DBI Notices of Violation ──────────────────────────
// Socrata nbtm-fbw5. NOV is the actual notice of violation.
export const sfDbiNovs: CodeScraper = buildSocrataScraper({
  id: "sf-dbi-novs",
  label: "SF DBI Notices of Violation",
  city: "San Francisco",
  state: "CA",
  endpointUrl: "https://data.sfgov.org/resource/nbtm-fbw5.json",
  fieldMap: {
    address: "address",
    description: "complaint_description",
    status: "status",
    filingDate: "date_filed",
    caseNumber: "complaint_number"
  },
  openCasesWhere: "status != 'Complaint Closed'",
  extractCode: (row) => {
    const desc = String(row.complaint_description ?? "").toUpperCase();
    if (desc.includes("SUBSTANDARD")) return "SUBSTANDARD";
    if (desc.includes("UNSAFE")) return "UNSAFE";
    if (desc.includes("ABATEMENT")) return "ABATEMENT_ORDER";
    return "NOV";
  }
});

// ── Detroit Blight Violations ───────────────────────────────────────
// ArcGIS FeatureServer. Detroit ticket categories well-defined.
export const detroitBlightViolations: CodeScraper = buildArcgisScraper({
  id: "detroit-blight-violations",
  label: "Detroit Blight Violations",
  city: "Detroit",
  state: "MI",
  // Detroit's blight FeatureServer endpoint pattern (verify before
  // launch). Operator may need to adjust this if the city republishes
  // the dataset.
  featureServerUrl:
    "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/Blight_Violations/FeatureServer/0",
  fieldMap: {
    address: "Violation_Address",
    description: "Violation_Description",
    violationCode: "Violation_Code",
    status: "Hearing_Outcome",
    filingDate: "Ticket_Issued_DT",
    caseNumber: "Ticket_id",
    ownerName: "Violator",
    fineAmount: "Judgment_Amt"
  },
  openCasesWhere: "Hearing_Outcome NOT IN ('PAID', 'DISMISSED', 'PD IN COLLECTIONS')",
  extractCode: (attrs) => {
    const desc = String(attrs.Violation_Description ?? "").toUpperCase();
    if (desc.includes("DANGEROUS") || desc.includes("UNSAFE")) {
      return "DANGEROUS_BUILDINGS";
    }
    if (desc.includes("DEMOLITION")) return "DEMOLITION_ORDER";
    if (desc.includes("RUBBISH") || desc.includes("DEBRIS")) {
      return "RUBBISH_TIRES";
    }
    return "BLIGHT_TICKET";
  }
});

// ── Cincinnati Code Enforcement ─────────────────────────────────────
// Socrata cncm-znd6. Covers buildings, demo, property, zoning, vehicles.
export const cincinnatiCodeEnforcement: CodeScraper = buildSocrataScraper({
  id: "cincinnati-code-enforcement",
  label: "Cincinnati Code Enforcement",
  city: "Cincinnati",
  state: "OH",
  endpointUrl: "https://data.cincinnati-oh.gov/resource/cncm-znd6.json",
  fieldMap: {
    address: "address",
    description: "violation_description",
    violationCode: "violation_code",
    status: "status",
    filingDate: "open_date",
    caseNumber: "complaint_id"
  },
  openCasesWhere: "status != 'Closed'",
  extractCode: (row) => {
    const desc = String(row.violation_description ?? "").toUpperCase();
    if (desc.includes("UNSAFE")) return "UNSAFE";
    if (desc.includes("CONDEMN")) return "CONDEMNED";
    if (desc.includes("MAINTENANCE")) return "MAINTENANCE";
    if (desc.includes("ZONING")) return "ZONING";
    return undefined;
  }
});

// ── Columbus OH Code Enforcement ────────────────────────────────────
// ArcGIS via opendata.columbus.gov. Tyler EnerGov is the back-end;
// they expose a FeatureServer mirror.
export const columbusCodeEnforcement: CodeScraper = buildArcgisScraper({
  id: "columbus-code-enforcement",
  label: "Columbus Code Enforcement",
  city: "Columbus",
  state: "OH",
  // Columbus FeatureServer pattern (verify URL — they republish
  // periodically with new IDs).
  featureServerUrl:
    "https://opendata.columbus.gov/datasets/columbus::code-enforcement-cases/FeatureServer/0",
  fieldMap: {
    address: "ADDRESS",
    description: "VIOLATION_TYPE",
    violationCode: "VIOLATION_CODE",
    status: "STATUS",
    filingDate: "OPEN_DATE",
    caseNumber: "CASE_ID"
  },
  openCasesWhere: "STATUS NOT IN ('Closed', 'CLOSED', 'C')",
  extractCode: (attrs) => {
    const t = String(attrs.VIOLATION_TYPE ?? "").toUpperCase();
    if (t.includes("CONDEMN")) return "CONDEMN";
    if (t.includes("UNSAFE")) return "UNSAFE";
    if (t.includes("STRUCTURAL")) return "STRUCTURAL";
    if (t.includes("EXTERIOR")) return "EXTERIOR";
    if (t.includes("WEEDS")) return "WEEDS";
    return undefined;
  }
});

// ── Baltimore County Vacant Properties Registry ─────────────────────
// ArcGIS. Vacant-property registry = strong-distress baseline (tier 2).
export const baltimoreCountyVacants: CodeScraper = buildArcgisScraper({
  id: "baltimore-county-vacants",
  label: "Baltimore County Vacant Properties",
  city: "Baltimore",
  state: "MD",
  featureServerUrl:
    "https://opendata.baltimorecountymd.gov/datasets/BC-GIS::vacant-properties/FeatureServer/0",
  fieldMap: {
    address: "ADDRESS",
    description: "STATUS",
    status: "STATUS",
    filingDate: "REGISTRATION_DATE",
    caseNumber: "PARCEL_ID",
    ownerName: "OWNER_NAME"
  },
  // Registry = perpetually "open" unless removed.
  openCasesWhere: "STATUS = 'ACTIVE'"
});

// ── Philadelphia L&I Code Violations ────────────────────────────────
// OpenDataPhilly serves L&I tables via Carto SQL API. Different
// protocol from Socrata/ArcGIS — uses postgres-style SQL over HTTPS.
// Implemented as a city-custom scraper to keep the protocol-specific
// quirks isolated.
export const philadelphiaLiViolations: CodeScraper = {
  id: "philadelphia-li-violations",
  label: "Philadelphia L&I Code Violations",
  kind: "city_custom",
  states: ["PA"],
  cities: ["Philadelphia"],
  requiresCredentials: [],
  async run(ctx) {
    const sinceIso = ctx.sinceFilingDate.slice(0, 10);
    // Philly L&I publishes via Carto SQL API at phl.carto.com.
    const sql = `SELECT casenumber, address, violationcode, violationcodetitle,
                        violationdescription, casestatus, casecreateddate, opa_account_num
                 FROM violations
                 WHERE casecreateddate >= '${sinceIso}'
                   AND casestatus != 'CLOSED'
                 ORDER BY casecreateddate DESC
                 LIMIT ${ctx.maxRecords}`;
    const url = `https://phl.carto.com/api/v2/sql?q=${encodeURIComponent(sql)}`;
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" }
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `Philly Carto ${res.status}`,
          retryable: res.status >= 500 || res.status === 429
        };
      }
      const body = (await res.json().catch(() => ({}))) as {
        rows?: Array<Record<string, unknown>>;
      };
      const rows = body.rows ?? [];
      const { classifySeverity } = await import(
        "@/lib/dealhawk/code-violation-severity"
      );
      const records = rows.flatMap((row) => {
        const address = row.address as string | undefined;
        const description = (row.violationdescription ??
          row.violationcodetitle) as string | undefined;
        const filing = row.casecreateddate
          ? new Date(String(row.casecreateddate))
          : null;
        if (!address || !description || !filing) return [];
        // Philly violation codes look like "PM-303.10" / "BC-1606.1" /
        // "FC-405.3" — first two chars indicate code family.
        const fullCode = String(row.violationcode ?? "");
        const family = fullCode.slice(0, 2).toUpperCase();
        const severity = classifySeverity({
          violationCode: family,
          violationDescription: description,
          filingDate: filing,
          city: "Philadelphia",
          state: "PA"
        });
        return [
          {
            propertyAddress: address.trim(),
            city: "Philadelphia",
            state: "PA",
            apn: row.opa_account_num as string | undefined,
            violationCode: fullCode || undefined,
            violationDescription: description.trim(),
            severityTier: severity.tier,
            status: String(row.casestatus ?? "open").toLowerCase(),
            filingDate: filing,
            caseNumber: row.casenumber as string | undefined,
            sourceUrl: "https://phl.carto.com/api/v2/sql",
            parserConfidence: 0.85,
            parserRawJson: row
          }
        ];
      });
      return { ok: true, records };
    } catch (err) {
      return {
        ok: false,
        error: `philly-li-violations fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true
      };
    }
  }
};

export const ALL_TIER1_SCRAPERS: CodeScraper[] = [
  chicagoBuildingViolations,
  nycHpdViolations,
  nycDobViolations,
  laCodeEnforcement,
  sfDbiNovs,
  detroitBlightViolations,
  cincinnatiCodeEnforcement,
  columbusCodeEnforcement,
  baltimoreCountyVacants,
  philadelphiaLiViolations
];
