# Dealhawk Empire — Code Violation Distress Lead Module
## Research-Backed Plan (2026-05)

This is a plan, not an implementation. Mirrors the structure of
DEALHAWK_PRE_FORECLOSURE_MODULE_PLAN.md so the operator can compare
the two side-by-side. All vendor pricing reflects 2026-05 research —
verify before contracting.

---

## DECISIONS LOCKED (2026-05-16)

| # | Decision | Locked answer | Architectural implication |
|---|---|---|---|
| 1 | City scope | **National via 3-tier strategy** | 10 pre-built city adapters at launch (Excellent tier, ready day-1). Generic Socrata + ArcGIS auto-discovery adapters that auto-wire when an operator adds any new city with an open-data portal (~250-500 cities reachable). CSV upload as the always-on universal fallback. **Honest caveat:** ~95% of US municipalities have NO public code-violation data; "national coverage" means *the framework can target any city*, not that every city has data. |
| 2 | Field-visit scope | **Full** | Visit list + route map + leave-behind generator + field observation capture + no-knock list (signage-triggered) + in-app field log. Operators can drive-by + leave letters end-to-end from the UI. |
| 3 | Photo face-blur | **Skipped (operator-discipline rules)** | No server-side CV step. The UI shows a one-line "Do not photograph identifiable people" rule + the operator's photo upload form refuses obvious-people photos via filename keyword filter only. Operators trained on the rule. Cheaper, simpler, operator-discipline-dependent. |
| 4 | Drone integration | **Skipped — future module** | No drone tooling in v1. FAA Part 107 + state drone-image laws too complex for this commit. |
| 5 | PropStream | **Wire as supplement** | Added to recommended integrations. Useful for list-stacking (code-violation × tax-delinquent × vacant overlays) even though code-violation coverage is opaque. |
| 6 | Solicitor permits | **Skipped (universal disclosure)** | No per-city permit table. Field-visit UI shows a universal disclaimer: "Some cities require a solicitor permit for door-to-door visits. Verify your city's ordinance before knocking. Operating without a permit may carry civil penalties." Operator burden, not platform burden. **No-Soliciting / No-Trespass sign auto-suppression stays** — that's safety, not permits. |
| 7 | CRM stages | **Compressed to 8 stages** | Maps cleanly onto existing `Deal.status` enum. Sub-statuses in `Deal.config.codeViolation.subStatus` for finer tracking. See updated §14. |
| 8 | Dashboard architecture | **Unified `/distress-leads`** | One dashboard for both pre_foreclosure + code_violation. Tabs/filters separate the two. Existing `/foreclosures` routes redirect to `/distress-leads?type=foreclosure`. Sub-routes (compliance, import, filters, setup) stay module-specific. |
| 9 | **NEW: Field-visit surfaces extend to pre_foreclosure** | **Yes — port the field-visit module to pre-foreclosure too** | The `FieldVisitNote` table + visit-list generator + route map + leave-behind template + log capture all serve both modules. Pre-foreclosure operators can now drive by + hand-deliver letters with the same workflow. **Higher legal exposure in pre-foreclosure** (state foreclosure statutes), so field-visit drafts route through State Compliance Review the same as mail drafts. |

### Defaults taken on the 4 unanswered questions (override anytime)

- **Two-party-consent recording disclosure** — Ship the disclaimer text + a checkbox the operator self-attests; leave actual recording to operator's own device.
- **Fair Housing audit cadence** — Quarterly.
- **PHIFA cross-check scope** — Maryland only at launch; flag "scheduled_hearing" cases in other states for operator review without auto-triggering the foreclosure compliance flow.
- **Skip-trace cap unification** — $0/mo default applies to both modules combined (one shared cap, not two). Operator raises via the existing spend-ceilings UI.

---

## 1. Executive Summary

### The opportunity

Code-violation properties are the second-richest distress signal in
residential REI after pre-foreclosure. A property with stacked open
violations (unsafe-structure designation, multiple unresolved
complaints, vacant registry entry, condemnation hearing scheduled)
is a high-probability motivated-seller scenario:

- **Owner is paying fines** — often $50-500 per violation, escalating
  if unresolved.
- **Owner faces liability exposure** — slip-and-fall on a boarded
  property, building collapse, fire risk.
- **Owner has often disengaged** — absentee landlord, inherited
  property, estate that doesn't want to deal with rehab.
- **City escalation is real** — receivership in MD, demolition order
  in OH, property tax sale in IL, condemnation hearing in CA.

This is genuinely free public data in the ~250-500 US cities that
publish open code-enforcement records — but it's CITY-level, not
county-level, and quality varies wildly by jurisdiction.

### What Dealhawk Empire already has

- **`code_violation` is already a recognized DealSignal type** with
  weight 15 in [lib/dealhawk/distress-score.ts](lib/dealhawk/distress-score.ts).
  Modest by design — code violations alone aren't urgent, but they
  stack with `vacancy` (+15), `absentee` (+10), `high_equity`
  (×1.5), `long_tenure` (×1.3) to produce strong composite scores.
- **A "Code Violation Tracker" workflow** is in the
  `DEALHAWK_WORKFLOWS` list — a weekly data-pull that feeds the
  Distress Signal Analyst. The workflow exists but has no specialist
  agent yet.
- **The full pre_foreclosure addon shipped last week** — adds 5
  agents, 1 workflow, 7 KB entries, attestation flows, dashboard,
  scoring extension, auction alerts, county-scraping framework.
  Architecturally analogous infrastructure that the code-violation
  addon reuses extensively.

### What's reusable from the pre_foreclosure addon

The pre_foreclosure module already shipped these — the code-violation
addon plugs into them:

| Infrastructure | Status | Code Violation use |
|---|---|---|
| `BusinessTemplate.addons[]` mechanism | ✅ Wired | Add a second addon entry on `dealhawk_empire` |
| County-scraping framework (`lib/dealhawk/county-scrapers/`) | ✅ Wired with FL legal-notice + Maricopa AZ + Dallas TX scrapers | Add new scrapers for Chicago, NYC HPD, LA, Philadelphia, SF, Detroit code-enforcement endpoints |
| Skip-trace integration (BatchSkipTracing) | ✅ Live REST handler | Reuse `batch_skip_lookup` tool directly; same per-query purposeCode + GLBA gate |
| Address normalization (Smarty) | ✅ Live | Reuse `smarty_normalize_address` |
| Phone line-type (Twilio Lookup) | ✅ Live | Reuse `twilio_lookup_phone` |
| DNC scrub (RealPhoneValidation) | ✅ Live | Reuse `dnc_scrub` |
| Entity resolution (OpenCorporates) | ✅ Live | Reuse `opencorporates_search` |
| Direct mail (Lob postcard + letter) | ✅ Live REST + approval-gated | Reuse `lob_create_postcard` + `lob_create_letter` |
| Approval gate (`DANGEROUS_TOOLS` + `ALWAYS_APPROVE_REQUIRED`) | ✅ Wired | Reuse for all code-violation outreach |
| State Compliance Review Agent pattern | ✅ Live for foreclosure | Build code-violation equivalent (smaller scope) |
| Dashboard pattern (`/admin/businesses/[id]/foreclosures`) | ✅ Live | Mirror at `/admin/businesses/[id]/code-violations` |
| Attestation flow pattern | ✅ Live | Build city-permit + Fair-Housing attestation flow |
| `DealSignal` table with `signalType="code_violation"` | ✅ Live | Continue using; no new table needed for signal layer |
| Scoring engine (`preForeclosureScore` decomposition) | ✅ Live | Build analogous `codeViolationScore` |
| Auction-imminent notifications pattern | ✅ Live | Build analogous "demolition-imminent" + "receivership-imminent" |

### What's genuinely new for code-violation

1. **Two new Prisma tables** — `CodeViolationRecord` (raw violation
   case data) + `FieldVisitNote` (operator field-visit log; shared
   with pre_foreclosure per decision #9). One Deal can have many of
   each over time.
2. **6 new agents** in the addon: County/City Source Research Agent,
   Code Violation Scraper Agent, Code Case Parser Agent, Code Violation
   Severity Scorer Agent, Field Visit Prep Agent, Outreach Prep Agent.
   The Skip Trace Agent + State Compliance Review Agent from the
   pre_foreclosure addon are shared (same agents, expanded scope).
   The pre_foreclosure addon also gains its own Field Visit Prep
   Agent (decision #9) — parallel agent, same shared infrastructure.
3. **3-tier scraper architecture** (decision #1) — 10 pre-built city
   adapters (Chicago, NYC HPD/DOB, LA, Philly, SF, Detroit, Cincinnati,
   Columbus, Baltimore Co) + generic Socrata + ArcGIS Hub
   auto-discovery adapters (any open-data city) + generic Accela /
   Tyler EnerGov scraper templates (any tenant of those CMS vendors).
4. **Field-outreach surfaces** — visit list, route map, leave-behind
   templates, field observation capture. Code-violation has it natively;
   pre_foreclosure also gets it per decision #9 with stricter compliance
   gating.
5. **15 new KB entries** on code-violation specifics, field outreach
   safety, Fair Housing risk, leave-behind compliance.
6. **Unified `/distress-leads` dashboard** (decision #8) replacing
   the existing `/foreclosures` route. Old URLs redirect with module
   filter querystring.

### Build size

Roughly **25-35 engineering days** across 3 shippable commits, similar
shape to the pre_foreclosure module. Because so much infrastructure is
reusable, this is faster per-line than the foreclosure module was.

---

## 2. How the Code Violation Distress Lead Agent Works

### One-paragraph version

The Code Violation Distress Lead module runs a daily sweep against
operator-configured city portals (Socrata + ArcGIS Hub + Accela +
Tyler EnerGov), parses each new violation into a CodeViolationRecord,
scores it on a 0-100 composite (violation severity, owner motivation,
deal potential, contactability, risk/compliance), enriches the property
+ owner via RentCast + Realie + BatchSkipTracing, routes through a
Compliance Review gate (Fair Housing + UDAAP + city-solicitor-permit
check + foreclosure-rescue cross-check for MD condemnation cases), and
queues two outreach paths: (a) Lob direct-mail draft → approval queue
→ real mail piece, and (b) field-visit list → route map → operator
drive-by + leave-behind. Every step is reversible, audit-logged, and
gated behind operator attestation in the 7 high-risk states.

### Flow at a glance

```
Operator-configured cities  +  CSV upload (always-on fallback)
            │
            ▼
   Code Violation Scraper Agent  (Socrata/ArcGIS/Accela/Tyler adapters)
            │
            ▼
   Code Case Parser Agent  (severity classification + dedup)
            │
            ▼
   CodeViolationRecord row  →  DealSignal (signalType="code_violation")
            │
            ▼
   Property Enrichment  (RentCast/Realie/Smarty)
            │
            ▼
   Skip Trace Agent  (when GLBA attestation on file; manual-approval default)
            │
            ▼
   Severity Scorer Agent  (composite 0-100 + recommendation)
            │
            ▼
   Compliance Review  (Fair Housing + UDAAP + state cross-check + permit check)
            │
            ▼
   Outreach Prep Agent
            │
   ┌────────┴────────┐
   ▼                 ▼
 Lob mailer       Field visit
   ↓                 ↓
 Approval queue   Route map + leave-behind template
   ↓                 ↓
 Operator approves Operator drives by + uploads observations
   ↓                 ↓
 Lob fires        Field outcome captured (no-knock list, opt-out, etc.)
```

---

## 3. Data Source Research Process

### How the agent discovers what's available for a city

When an operator adds a new city to their priority list:

1. **County / city resolution.** Operator inputs "Detroit, MI" or
   "Cuyahoga County, OH". The agent normalizes to (state, city,
   county) tuple.
2. **Known-source lookup.** Agent checks a hardcoded
   `KNOWN_CITY_SOURCES` map (~30 cities pre-mapped from research).
   For these, scraper id + dataset URL is already known.
3. **Open-data portal sweep.** For unknown cities, agent queries
   the common open-data hosts to detect:
   - `data.{city}.gov` and `data.cityof{name}.gov` (Socrata)
   - `opendata.{city}.gov` (ArcGIS Hub)
   - `data.{state}.us` (state-level Socrata)
   When a portal exists, search for code-enforcement-named datasets
   ("code enforcement", "building violation", "blight", "vacant
   registry", "housing maintenance").
4. **Case-management-system signature check.** Agent probes for
   common URL patterns:
   - `aca-prod.accela.com/{TENANT}/` — Accela
   - `energovweb.{city}.gov` or `selfservice.{tenant}.gov` — Tyler
   - `cityworks.{tenant}.gov` — Cityworks
   - `permits.{city}.gov/eclipse` — Philly
5. **Manual fallback.** When no automated source is found, agent
   surfaces a "CSV upload only" status for that city. The operator
   can still ingest leads by exporting from the city portal manually.

The agent does NOT attempt to bypass authentication, solve CAPTCHAs,
or scrape sites that prohibit automation in their ToS. Per-source
ToS posture is captured in the source-registry entry.

### Honest data availability map

| Coverage tier | Cities (rough count) | What's there | Examples |
|---|---|---|---|
| **Excellent** (machine-readable, daily refresh, severity classified) | ~25-40 | Socrata or ArcGIS dataset with clear field menu | Chicago, NYC HPD/DOB, LA, Philly, SF, Detroit, Boston, Cincinnati, Columbus OH, KCMO, Phoenix, Austin, Seattle |
| **Good** (machine-readable, weekly+ refresh, partial fields) | ~50-100 | Socrata/ArcGIS but spotty fields or freshness | Houston CKAN, Baltimore County, Atlanta Open Data, DC, Sacramento, Dallas, Denver, Indianapolis |
| **Scrapeable** (public portal, no API) | ~200-400 | Accela Citizen Access or Tyler EnerGov public access | Atlanta (Accela), San Diego, Sacramento, Long Beach, many mid-size cities |
| **Manual only** | ~18,000+ | Paper file, FOIA-only, no online search | Rural cities, small towns, most unincorporated areas |

### The 3-tier national-coverage strategy (decision #1)

To get "national coverage" without writing 250+ per-city scrapers,
the architecture is:

**Tier 1 — Pre-built city adapters (10 cities at launch, room for ~50)**

Custom scraper per city, hand-tuned for each dataset's field shape +
severity-classification rules. Best data quality. Ships day-1 with:
Chicago, NYC HPD, NYC DOB, LA, Philadelphia L&I, SF DBI, Detroit
Blight, Cincinnati, Columbus OH, Baltimore County. Adding a new
city to this tier = ~4-8 hours of engineering work per city +
maintenance when the city changes their portal layout.

**Tier 2 — Generic auto-discovery adapters (covers any
Socrata-or-ArcGIS city without per-city engineering)**

When an operator adds a city the platform doesn't have a pre-built
adapter for, the County / City Source Research Agent runs the
auto-discovery flow (§4):

1. Probe `data.{city}.gov`, `data.cityof{name}.gov`, `opendata.{city}.gov`
   for Socrata or ArcGIS Hub portals.
2. If found, search dataset catalog for code-enforcement-named
   datasets ("code enforcement", "building violation", "blight",
   "vacant registry", "housing maintenance").
3. Show the operator the discovered field shape; operator confirms
   the field mapping (address column, status column, filing date
   column, etc).
4. Save the mapping as a "generic Socrata adapter instance" or
   "generic ArcGIS Hub adapter instance" tied to that city.
5. Daily sweep now includes that city.

This covers an estimated **250-500 US cities** without per-city code,
because most cities that publish anything code-related publish it
on Socrata or ArcGIS Hub. The cost is per-city data-quality
variance — the generic adapter can't classify violation severity
the way a hand-tuned city adapter does, so cities added via Tier 2
default to Tier 3 ("Moderate") severity until the operator
overrides per record.

**Tier 3 — Generic Accela / Tyler EnerGov scraper templates
(covers any tenant of those CMS vendors)**

When the city's portal is Accela Citizen Access or Tyler EnerGov
Civic Access (no API, but same software backbone everywhere),
operator inputs the tenant URL + completes a per-tenant ToS
attestation. A vendor-template scraper adapts to the tenant's
form/results layout (mostly stable across tenants for the same
vendor). Adds another ~300-500 cities to reach.

**Tier 4 — CSV upload (universal fallback for every remaining city)**

The vast majority of US municipalities (~18,000) have no automated
data. The operator can still ingest leads from those cities by
exporting from the city portal manually, downloading a FOIA
response as CSV, or buying a list from a local data reseller — all
of which flow through the same `/admin/businesses/[id]/code-violations/import`
route.

### What "national coverage" honestly means

- **Day-1 plug-and-play**: 10 cities (Tier 1).
- **Operator-added with auto-wire**: any of ~250-500 cities (Tier 2 + Tier 3).
- **Operator-added with manual export**: any of ~19,500 US
  municipalities (Tier 4).
- **Cities with no usable data at all**: roughly half of the
  manual-tier cities, where the city itself doesn't publish or sell
  code data. These are reachable only via door-knocking + driving
  for dollars — no data path.

The system is designed so an operator who wants to expand to a new
city always has a path forward: either it's already automated, or
auto-discovery picks it up, or CSV upload covers it. **There's no
"this city is impossible" outcome unless the city itself doesn't
publish any data.**

---

## 4. County / City Source Discovery Workflow

When the operator enables the addon, the dashboard shows a
"Source Discovery" wizard:

### Step 1 — Pick target cities
Operator types or selects from a list. System suggests cities based
on the operator's existing buy-box (e.g. if buy-box has "Memphis, TN",
suggest Memphis-area code sources).

### Step 2 — Per-city source check
For each city, the agent runs the discovery flow above. Returns one
of:
- ✅ **Open data** — Socrata or ArcGIS dataset detected. Auto-wires
  scraper, runs sample fetch, shows operator the field menu.
- ⚠ **Scrape required** — Accela / Tyler / custom portal detected.
  Shows operator the ToS link, the rate-limit posture, and a
  "I've read the ToS and confirm scraping is permitted" attestation
  checkbox. No auto-enable.
- ⛔ **No source** — manual CSV upload only. Operator can still add
  the city; ingest is operator-driven.

### Step 3 — Schedule
Operator confirms scrape frequency (daily / weekly / on-demand) and
the sweepHourLocal (default 7am, same hour as the existing Dealhawk
sourcing sweep).

### Step 4 — First fetch
Agent runs a one-time backfill (last 30 days of violations).
Records land in `CodeViolationRecord` with parser confidence scored
per source.

---

## 5. Violation Severity Framework

Per the user's brief, four tiers:

| Tier | Score weight | Examples | Source-field patterns |
|---|---|---|---|
| **Tier 1 — Extreme Distress** | 35 | Unsafe structure, condemned, demolition order, fire damage, open/vacant structure, structural failure | Chicago: `violation_status = "OPEN"` + `violation_code LIKE "CN13%"`; NYC HPD: `class = "C"` (immediately hazardous); LA: case type contains "Order to Comply" + "Substandard" |
| **Tier 2 — Strong Distress** | 22 | Repeated unresolved violations (3+ open cases on same property), major exterior damage, severe neglect, vacant property registration | 3+ open cases on same parcel; NYC HPD class B; LA "Order to Comply" without "Substandard"; presence on vacant registry |
| **Tier 3 — Moderate Distress** | 12 | Overgrown yard, junk/debris, abandoned vehicles, minor maintenance | NYC HPD class A; Chicago violation codes for property maintenance (CN18*); LA notice-of-deficiency |
| **Tier 4 — Low Signal** | 4 | Single minor violation, short-term open case (<30 days), resolved | Single open case <30 days old; or status = resolved/closed; LA "Notice of Inspection" |

### Severity-classification approach

Most feeds don't ship with a severity field. The Code Case Parser
Agent infers severity by:

1. **Code-prefix matching** — per-city dictionary built from research
   (e.g. Chicago CN13 = unsafe, NYC HPD class A/B/C is explicit, LA
   has "Order to Comply" + "Substandard").
2. **Keyword matching** in violation description — "unsafe",
   "condemned", "demolition", "vacant", "fire", "structural",
   "boarded", "open and accessible" all bump tier.
3. **Case-count aggregation** — 3+ open cases on the same parcel
   bumps to Tier 2 regardless of individual case severity.
4. **Age weighting** — cases open >180 days bump tier (operator
   indifference signal).
5. **Manual operator override** per record (the dashboard exposes
   a "bump severity" / "demote severity" button for operators who
   know their cities better than the parser does).

### The Code Severity Dictionary

A maintained JSON file (`lib/dealhawk/code-violation-severity.ts`)
mapping per-city violation-code prefixes to tiers. Shipping
with mappings for the 12 verified cities; operators can extend per
business via `Business.config.codeViolation.severityOverrides`.

---

## 6. Data Ingestion Strategy

### Source priority (mirrors pre_foreclosure)

1. **Open data API (Socrata + ArcGIS Hub)** — primary path for the
   25-40 cities in the Excellent tier. Free, daily refresh, no ToS
   friction.
2. **Scraping (Firecrawl + later Browserbase)** — for Accela / Tyler /
   custom portals. Per-tenant ToS check required before auto-enable.
3. **Commercial aggregator (PropStream)** — supplement, never primary.
   Coverage opaque + per-listing rather than per-violation.
4. **CSV upload (always-on fallback)** — operator-driven for cities
   with no programmatic feed. Same code path as the pre_foreclosure
   CSV import.

### Scraper framework reuse

The pre_foreclosure module already shipped a `CountyScraper` contract
in `lib/dealhawk/county-scrapers/`. Code-violation scrapers use the
SAME contract, just with different `kind` values:

- `kind: "socrata_dataset"` — for Socrata code-enforcement datasets
- `kind: "arcgis_feature_service"` — for ArcGIS code-enforcement
  layers
- `kind: "accela_citizen_access"` — for Accela ASP.NET portals
- `kind: "tyler_energov"` — for Tyler EnerGov Civic Access
- `kind: "city_custom"` — NYC HPD, Chicago, Philly, etc.

The runner (`lib/dealhawk/county-scrapers/runner.ts`) is reused
without changes.

### Initial scraper roster (Commit 1 ships these)

| Scraper | City | Type | Source URL pattern |
|---|---|---|---|
| `chicago-building-violations` | Chicago, IL | Socrata | `data.cityofchicago.org/resource/22u3-xenr.json` |
| `nyc-hpd-violations` | New York, NY | Socrata | `data.cityofnewyork.us/resource/wvxf-dwi5.json` |
| `nyc-dob-violations` | New York, NY | Socrata | `data.cityofnewyork.us/resource/3h2n-5cm9.json` |
| `la-code-enforcement` | Los Angeles, CA | Socrata | `data.lacity.org/resource/2uz8-3tj3.json` |
| `philly-li-violations` | Philadelphia, PA | Carto SQL | OpenDataPhilly L&I tables |
| `sf-dbi-novs` | San Francisco, CA | Socrata | `data.sfgov.org/resource/nbtm-fbw5.json` |
| `detroit-blight-violations` | Detroit, MI | ArcGIS | `data.detroitmi.gov` ArcGIS FeatureServer |
| `cincinnati-code-enforcement` | Cincinnati, OH | Socrata | `data.cincinnati-oh.gov/resource/cncm-znd6.json` |
| `columbus-code-enforcement` | Columbus, OH | ArcGIS | `opendata.columbus.gov` |
| `baltimore-county-vacants` | Baltimore Co., MD | ArcGIS | `opendata.baltimorecountymd.gov` |

10 working scrapers covers ~35% of the US urban housing stock at
launch. More can be added per-operator request.

---

## 7. Property Enrichment Workflow

Per record, the agent enriches in this order:

1. **Smarty normalize address** — same handler as pre_foreclosure.
   CASS-certified + rooftop geocode + DPV match code.
2. **Parcel join via Regrid OR Realie** — translates address to APN,
   pulls assessor data.
3. **RentCast** (already in Dealhawk integrations) — AVM, last sale
   date/price, year built, square footage.
4. **Realie** (already integrated) — owner name, mailing address,
   owner-occupied vs absentee inference.
5. **Vacancy check** — cross-reference against (a) vacant registry
   dataset if the city has one, (b) Realie's vacancy indicator, (c)
   USPS Vacant indicator via Smarty.
6. **Tax delinquency check** — if county tax-collector dataset is
   wired, query for delinquent status on the APN.
7. **Photo metadata** (operator-uploaded only) — file metadata
   captured for audit; auto-blur faces server-side.

### Fields persisted per record (CodeViolationRecord)

See §10 (Database Schema) for the full table. Key enrichment fields:
- `propertyAddressNormalized` (Smarty CASS form)
- `apn`
- `ownerName` + `ownerMailingAddress`
- `ownerOccupied` (boolean / nullable)
- `ownerEntityType` ("individual" / "llc" / "trust" / "estate")
- `estimatedPropertyValue`
- `estimatedEquityPercent`
- `lastSaleDate` + `lastSalePrice`
- `yearBuilt` + `livingSqft`
- `vacancyIndicator` (boolean, multi-source)

---

## 8. Owner Identification Workflow

Same as pre_foreclosure module. The agent reads
`CodeViolationRecord.ownerName` and:

1. If owner name is an individual: route to `batch_skip_lookup` with
   `purpose_code = "owner_research"` and the GLBA attestation gate.
2. If owner name is an LLC / corporation / trust: route to
   `opencorporates_search` first, resolve to UBO if possible, then
   skip-trace the natural-person UBO.
3. Persist a `SkipTraceResult` row tied to both the
   `CodeViolationRecord` AND any linked `Deal`.

The Skip Trace Agent + the SkipTraceResult table are the SAME ones
the pre_foreclosure module uses — code-violation skip-trace results
just get linked to a different parent record.

---

## 9. Skip Tracing Workflow

Same workflow + same gates as pre_foreclosure:

1. GLBA attestation must be on file
   (`Business.config.preForeclosure.glbaAttestation` — yes, the
   pre_foreclosure key; this is one shared attestation for both
   modules since the legal posture is the same).
2. Per-query `purposeCode` (one of: rei_investigation,
   property_acquisition, owner_research, manual_operator_lookup).
3. Spend cap default $0/mo (every query queues an ApprovalRequest);
   operator raises via spend ceilings UI.
4. Pipeline: Smarty (normalize) → BatchSkipTracing (resolve) →
   Twilio Lookup (line type) → DNC scrub. Same handlers; same
   audit trail.
5. SkipTraceResult retention 5 years.

**No new code needed for skip-trace.** All the infrastructure shipped
with the pre_foreclosure module is reused.

---

## 10. Field Outreach Workflow

This is the genuinely-new piece of this module (pre_foreclosure didn't
have it).

### What the field-outreach surface does

1. **Visit list generation** — operator selects N qualifying records;
   system generates a printable visit list sorted by score + auction-
   adjacent if applicable. Includes property address, owner name,
   score, scoring rationale, photo if available, "approach allowed"
   flag (no observed signage, not in no-soliciting permit-required
   city without permit on file).
2. **Route map** — Google Maps / Apple Maps deep link with all
   addresses pinned in order. Operator can optimize by Google's
   built-in routing.
3. **Leave-behind template generator** — produces a per-property
   personalized note that the operator prints and brings. Template
   conforms to the compliance constraints (Section 12). No reference
   to code violations. No government impersonation.
4. **Field observation capture** — operator opens a property's
   detail card, taps "Log field visit", records: visit outcome
   (no-answer / declined / conversation / leave-behind), signage
   observed (No-Soliciting / No-Trespass / Beware-of-Dog),
   photographs (geotagged, auto-blur faces server-side), free-text
   notes.
5. **No-knock list** — properties with observed "No Soliciting" or
   "No Trespass" signage auto-add to a per-business no-knock list
   and suppress future visit dispatch.
6. **Universal solicitor-permit disclosure** (decision #6) — instead
   of a per-city permit table, the visit-list generator displays a
   one-line disclosure at the top:
   > "Some cities require a solicitor permit for door-to-door visits.
   > Verify your city's ordinance before knocking. Operating without
   > a permit may carry civil penalties."
   The operator self-attests they've checked before exporting the
   list. No per-city lookup; no auto-suppression.

### Field-visit safety rules (system-enforced)

The visit-list generator and the operator app enforce:

- **Time window**: 9:00 AM - 7:00 PM operator-local-time (configurable
  per city for stricter windows like FL 9-8).
- **Visible signage = abort**: any No-Soliciting / No-Trespass /
  Beware-of-Dog sign captured during drive-by auto-suppresses approach.
  (Per decision #6, this is the only signage-based gate; there is no
  per-city solicitor-permit gate.)
- **No backyard**: visit detail card explicitly says "front door only;
  do NOT walk to side/rear; do NOT open gates."
- **No structure entry**: never. Period.
- **No mailbox placement**: 18 U.S.C. § 1725 — never anything in or
  on a mailbox. Door-handle only.
- **Two-party-consent recording disclosure** (decision-default):
  ship a one-line UI advisory for the 11 two-party-consent states
  (CA, CT, FL, IL, MD, MA, MT, NV, NH, PA, WA) — actual recording
  happens on operator's own device, platform doesn't manage the
  recording itself.
- **No photos of identifiable people** (decision #3): rule-only,
  no server-side face-blur. The operator app surfaces a one-line
  warning at photo-capture time and a filename-keyword check at
  upload (rejects "selfie", "person", "people", "kids" in filename).
  Operator-discipline-dependent.
- **Drone use disabled at launch** (decision #4) — future module.
- **HOA / gated community detection**: when address falls in a
  detected HOA, surface a warning.

### Leave-behind template — verified compliant baseline

```
[Investor Company Name]
[Street Address] · [City, State ZIP] · [Phone] · [Email]
[State RE license # if applicable]

Hello,

I stopped by today and you weren't home. I'm a local real-estate
investor and I sometimes buy homes that need repairs, directly
from owners, in as-is condition.

I am not affiliated with any city, county, or government office. I
am not offering legal, financial, or code-compliance advice. I'm
simply leaving my contact information in case selling is something
you'd like to explore.

If you'd prefer not to be contacted again, please call or text
[opt-out number] or email [opt-out email] and we will remove your
property from our list within 24 hours.

Best regards,
[Operator Name]

Operator Permit # [if required by city]. This is a commercial
solicitation.
```

**This template is intentionally code-violation-NEUTRAL.** Operators
cannot edit out the disclaimers. Operators CAN add a personalized
opening line via the dashboard, subject to the State Compliance
Review Agent's forbidden-pattern filter.

---

## 10.5 Field Visit Surfaces — Extension to Pre-Foreclosure (decision #9)

Per the operator's request, the field-visit module ALSO ships for the
pre_foreclosure addon. Pre-foreclosure leads are often best served by
a hand-delivered letter (more personal than mail, more respectful
than a phone call to someone facing foreclosure). The infrastructure
is shared — same `FieldVisitNote` table, same visit-list generator,
same route map, same leave-behind workflow — but the compliance gates
are **stricter** for pre-foreclosure because of the state foreclosure
statutes.

### What's different for pre-foreclosure field visits

1. **State Compliance Review on every leave-behind draft.** Same
   review the mail drafts go through. The 7 high-exposure states
   (CA / MD / IL / MN / CO / NY / FL) gate field-visit dispatch on
   per-state attestation being on file — operator can't generate a
   visit list for a CA lead unless they've completed the CA
   attestation.

2. **Pre-foreclosure-specific leave-behind template**. Avoids the
   word "foreclosure" entirely in the consumer-facing copy. Same
   universal disclaimers + HUD-counselor referral. Sample:

   ```
   [Investor Company Name]
   [Street Address] · [City, State ZIP] · [Phone] · [Email]
   [State RE license # if applicable]

   Hello,

   I stopped by today and you weren't home. I'm a local real-estate
   investor and I sometimes buy homes directly from owners in
   as-is condition.

   I am not a lender, attorney, real estate agent, or government
   representative, and I am not affiliated with any city, county,
   or government office. I am not offering legal, financial, or
   foreclosure-prevention advice.

   You have the right to speak with a HUD-approved housing counselor
   for free at 1-800-569-4287 or hud.gov/findacounselor before
   making any decision about your property.

   If you'd like to talk about selling, please call or text me at
   [phone]. If you'd prefer not to be contacted again, reply STOP
   or call [opt-out number] and I'll remove your information within
   24 hours.

   Best regards,
   [Operator Name]

   Operator Permit # [if required by city]. This is a commercial
   solicitation.
   ```

   **Notice what's absent**: any mention of the foreclosure filing,
   "code violations", auction date, lender, or case number. The lead
   should never feel surveilled.

3. **Per-state statutory notice attachment.** In CA / MD / IL / MN /
   CO / NY / FL, when the operator generates a field-visit letter,
   the state's verbatim statutory notice (already maintained in
   `lib/dealhawk/foreclosure-state-compliance.ts`) attaches as a
   second page. The operator must NOT remove it; the system bakes
   it into the printable PDF.

4. **Auction-imminent field-visit prioritization.** When a
   pre-foreclosure lead has score ≥75 AND auction <30 days, the
   visit-list generator highlights it as a "field visit recommended
   before next outreach" candidate — at that auction proximity,
   hand-delivery is often more impactful than mail timing-wise.

5. **No-knock posture is universal.** Same observed-signage
   auto-suppression. Pre-foreclosure operators are not exempt from
   the No-Soliciting / No-Trespass / Beware-of-Dog rules.

### Shared surface, module-aware routing

- `/admin/businesses/[id]/distress-leads/visits` — the unified
  visit-list surface (per decision #8). The operator filters by
  module ("Pre-Foreclosure" / "Code Violation" / "Both") and the
  visit list draws from both record types.
- `FieldVisitNote.sourceModule` records which module produced the
  visit so per-module reporting + audit trails remain clean.
- Both modules' Field Visit Prep Agents call the SAME tool stubs
  (visit-list generator, route map, leave-behind PDF). Agent
  prompts differ — the pre_foreclosure Field Visit Prep Agent's
  prompt emphasizes the "never mention the foreclosure" rule.

### Implementation note

The Field Visit Prep Agent + the `FieldVisitNote` table ship as part
of **the code-violation module's Commit 1** because that's where the
table is added. The pre_foreclosure addon's `extraAgents` array gets
a parallel Field Visit Prep Agent entry in the SAME commit, with its
own prompt template. So commit ordering doesn't matter — the
infrastructure ships once and both modules consume it.

---

## 11. Agentic Workflow Design

### New agents added to the dealhawk_empire team via the addon

**Six new agents** (vs the pre_foreclosure addon's 6). The Skip Trace
Agent + State Compliance Review Agent from pre_foreclosure are
shared (their tools[] and prompts cover both modules).

#### 11.1 County / City Source Research Agent
- **Purpose**: When operator adds a city to the priority list, run
  the discovery flow (§4) and register a working source.
- **Inputs**: City + state, operator preferences (frequency, ToS
  attestation).
- **Outputs**: Source-registry entry (scraper id / dataset URL / ToS
  status / freshness expectation).
- **Tools**: `knowledge_lookup`, `web_search`, `firecrawl_scrape`,
  `propose_todo`.
- **Failure handling**: When no source found, surface "manual CSV
  upload only" to operator + log a todo to revisit quarterly.

#### 11.2 Code Violation Scraper Agent
- **Purpose**: Daily fanout against registered sources. Equivalent
  to pre_foreclosure's County Records Scraper.
- **Inputs**: Source registry, last-scrape cursor.
- **Outputs**: Raw `CodeViolationRecord` rows with parser-raw-text +
  source URL + timestamp.
- **Tools**: `knowledge_lookup`, `web_search`, plus the underlying
  scraper-runner (programmatic, not LLM-exposed).
- **Failure handling**: Per-source failure isolated. Repeat failures
  → escalate via `propose_todo` + `send_telegram_message`.

#### 11.3 Code Case Parser Agent
- **Purpose**: Parse raw violation rows into structured fields +
  classify severity tier via the Code Severity Dictionary.
- **Inputs**: Raw `CodeViolationRecord` rows in pending state.
- **Outputs**: Structured fields (violation type, severity tier,
  status, case#, parties).
- **Tools**: `knowledge_lookup` (severity dictionary).
- **Failure handling**: Low-confidence parses → flag for operator
  review, do not promote.

#### 11.4 Code Violation Severity Scorer Agent
- **Purpose**: Compose the 0-100 composite per record (§14).
- **Inputs**: Enriched `CodeViolationRecord` + property data + skip-
  trace result.
- **Outputs**: `scoreSnapshot` on the record + scoring breakdown
  stored in `CodeViolationRecord.scoreBreakdown` JSON.
- **Tools**: `knowledge_lookup`, `property_value_estimate`
  (existing), `property_comps` (existing).
- **Implementation**: extends `lib/dealhawk/distress-score.ts` with a
  new `codeViolationScore()` function (parallel to
  `preForeclosureScore`).

#### 11.5 Field Visit Prep Agent
- **Purpose**: Build visit lists, route maps, leave-behind templates.
- **Inputs**: Operator-selected records (or top-N by score).
- **Outputs**: Visit list (with score + score rationale + photo +
  approach-allowed flag) + Google Maps route URL + per-property
  leave-behind PDF/text.
- **Tools**: `knowledge_lookup`.
- **Approval checkpoint**: Operator confirms the visit list before
  the route generates. Visit list always queues for operator review,
  never auto-fires.

#### 11.6 Outreach Prep Agent (code-violation flavor)
- **Purpose**: Draft direct-mail outreach for the code-violation
  pipeline. Mirrors the pre_foreclosure Outreach Prep Agent.
- **Inputs**: Qualified record + skip-trace result.
- **Outputs**: ApprovalRequest with full Lob postcard / letter draft.
- **Tools**: `knowledge_lookup`, `lob_create_postcard`,
  `lob_create_letter`, `send_email` (for follow-up to responders).
- **Hard rules**: Every draft routes through State Compliance Review
  + the system's Fair Housing forbidden-pattern filter. NEVER
  references code violations in the consumer-facing copy.

#### 11.7 Shared agents from pre_foreclosure (no duplication)
- **Skip Trace Agent** — same agent serves both modules. The
  `purposeCode` enum + GLBA attestation gate apply identically.
- **State Compliance Review Agent** — same agent; its KB expands to
  include code-violation-specific compliance rules
  (Fair Housing, UDAAP, MD condemnation cross-check).

---

## 12. Knowledge Base Outline

15 new KB entries (vs pre_foreclosure's 15). Tiered hot / warm /
cold per the existing tiering system.

| # | Title | Tier | Assigned agents |
|---|---|---|---|
| 1 | What code violations are + why they signal motivated sellers | warm | All addon agents |
| 2 | City vs county data — where to look + why municipal-first | warm | Source Research, Scraper |
| 3 | Case-management systems reference (Accela / Tyler / OpenGov / Cityworks) | warm | Source Research, Scraper |
| 4 | Code Severity Dictionary — per-city violation-code → tier map | hot | Parser, Severity Scorer |
| 5 | Severity-tier framework + scoring weights | hot | Severity Scorer |
| 6 | Public records terminology (ICC, OPA, NOV, condemnation, receivership) | warm | All addon agents |
| 7 | Absentee owner indicators + how to detect | warm | Owner ID (shared), Scorer |
| 8 | Vacancy + abandonment indicators (multi-source heuristic) | warm | Scraper, Scorer |
| 9 | Fair Housing disparate-impact risk for code-violation lists | hot | State Compliance Review, Outreach Prep |
| 10 | Forbidden copy patterns + safe alternatives (code-violation-specific) | hot | State Compliance Review, Outreach Prep |
| 11 | City solicitor-permit + Green River ordinance reference | hot | Field Visit Prep, Outreach Prep |
| 12 | Trespassing + Jardines license — front-door-only rules | hot | Field Visit Prep |
| 13 | Leave-behind / door-hanger / USPS-mailbox legal rules | hot | Field Visit Prep, Outreach Prep |
| 14 | Drone + photography rules + privacy + face-blur | warm | Field Visit Prep |
| 15 | MD condemnation cross-check with foreclosure-rescue statutes | hot | State Compliance Review |

Each entry 400-1500 words. Same shape as the pre_foreclosure KB.

---

## 13. Database Schema

### New table: `CodeViolationRecord`

```prisma
model CodeViolationRecord {
  id                        String    @id @default(cuid())
  businessId                String
  /// Linked Deal — populated once the record is promoted into the
  /// pipeline. Null while still in raw / pending state.
  dealId                    String?

  // Identity
  propertyAddress           String
  propertyAddressNormalized String?
  apn                       String?
  city                      String
  county                    String?
  state                     String

  // Violation detail
  /// Violation code from the source (e.g. "CN13007" for Chicago).
  violationCode             String?
  /// Free-text description from the source.
  violationDescription      String
  /// Inferred severity tier: 1 (extreme) through 4 (low).
  severityTier              Int
  /// "open" | "closed" | "in_compliance" | "scheduled_hearing"
  ///   | "demolition_ordered" | "condemned" | "vacated"
  status                    String
  filingDate                DateTime
  lastActionDate            DateTime?
  /// Scheduled hearing / inspection date if applicable.
  hearingDate               DateTime?
  caseNumber                String?

  // Parties
  ownerName                 String?
  ownerMailingAddress       String?
  ownerOccupied             Boolean?
  ownerEntityType           String?
  inspectorId               String?

  // Financial
  fineAmount                Decimal?
  /// Sum of fines on this parcel across all open cases.
  totalFinesParcelOpen      Decimal?

  // Source
  /// "socrata" | "arcgis" | "accela" | "tyler_energov"
  ///   | "city_custom" | "csv_import" | "manual"
  sourceType                String
  sourceUrl                 String?
  sourceTimestamp           DateTime  @default(now())
  parserConfidence          Float?
  parserRawText             String?   @db.Text
  parserRawJson             Json?

  // Workflow state
  /// "pending" | "enriched" | "failed" | "stale"
  enrichmentStatus          String    @default("pending")
  enrichmentAttempts        Int       @default(0)
  /// 0-100 composite at time of last scoring.
  scoreSnapshot             Int?
  /// Per-sub-signal breakdown for the dashboard.
  scoreBreakdown            Json?

  // Compliance flags
  /// Set when this property's owner / situation triggers a
  /// foreclosure-rescue statute cross-check (e.g. MD condemnation).
  needsForeclosureRescueReview Boolean @default(false)

  // Soft delete + timestamps
  deletedAt                 DateTime?
  createdAt                 DateTime  @default(now())
  updatedAt                 DateTime  @updatedAt

  business                  Business  @relation(fields: [businessId], references: [id])
  deal                      Deal?     @relation(fields: [dealId], references: [id])
  skipTraceResults          SkipTraceResult[]
  fieldVisitNotes           FieldVisitNote[]

  @@index([businessId])
  @@index([businessId, severityTier])
  @@index([businessId, status])
  @@index([state, filingDate])
  @@unique([businessId, sourceType, sourceUrl, caseNumber])
}
```

### New table: `FieldVisitNote`

Per decision #9, this table is **shared between pre_foreclosure and
code_violation** — both modules write here. The schema includes
nullable foreign keys to both `CodeViolationRecord` and
`ForeclosureRecord` so visits can be linked to either signal source.

```prisma
model FieldVisitNote {
  id                  String    @id @default(cuid())
  businessId          String
  codeViolationRecordId String?
  foreclosureRecordId String?
  dealId              String?

  /// Operator who logged the visit.
  operatorUserId      String?
  visitedAt           DateTime  @default(now())

  /// "no_answer" | "declined" | "conversation" | "leave_behind"
  ///   | "vacant_confirmed" | "occupied_confirmed" | "unsafe"
  ///   | "inaccessible" | "no_knock_signage"
  outcome             String

  /// Signage observed (operator multi-select).
  /// Values: "no_soliciting" | "no_trespassing" | "beware_of_dog"
  ///   | "for_sale_by_owner" | "no_signage_observed"
  signageObserved     Json
  /// Photo URLs (operator's R2 / S3 paths). NO server-side face-blur
  /// per decision #3 — operator-discipline rule only.
  photos              Json
  /// Operator's free-text notes.
  notes               String?   @db.Text

  /// Lat/lng of the visit (operator's device).
  visitLat            Float?
  visitLng            Float?

  /// Which module produced this visit ("code_violation" |
  /// "pre_foreclosure" | "manual"). Used by the unified dashboard to
  /// filter / report per-module.
  sourceModule        String    @default("manual")

  deletedAt           DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  business            Business  @relation(fields: [businessId], references: [id])
  codeViolationRecord CodeViolationRecord? @relation(fields: [codeViolationRecordId], references: [id])
  foreclosureRecord   ForeclosureRecord?   @relation(fields: [foreclosureRecordId], references: [id])
  deal                Deal?     @relation(fields: [dealId], references: [id])

  @@index([businessId])
  @@index([businessId, visitedAt])
  @@index([codeViolationRecordId])
  @@index([foreclosureRecordId])
}
```

### Additive columns on existing tables

**`Deal`** — add:
- `codeViolationCount Int @default(0)` — quick filter for properties
  with active code-violation signals
- `codeViolationSeverityHighest Int?` — highest tier across open
  cases on this property
- `lastCodeViolationDate DateTime?` — denormalized for fast sort

**`Business.config`** — JSON-only additions:
- `codeViolation: { enabled: boolean, cities: string[], severityFilter: number[], dailyIngestCap: number, fairHousingAuditedAt?: string, fairHousingAuditedBy?: string, cityPermits: Record<city, { permitNumber: string, expiresAt: string }> }`

### Indexing strategy
- `CodeViolationRecord(businessId, severityTier)` — drives the
  dashboard's "Tier 1 first" view.
- `CodeViolationRecord(businessId, status)` — open vs closed filter.
- `CodeViolationRecord(state, filingDate)` — cross-business analytics.
- `FieldVisitNote(businessId, visitedAt)` — recent activity view.

### Retention
- `CodeViolationRecord`: 730 days (longer than Message's 365d default
  because code cases run multi-year).
- `FieldVisitNote`: **5 years** for the audit trail + Fair Housing
  defense; photos auto-purge faces after 12 months unless converted
  to a consented marketing asset (operator action).

---

## 14. CRM Pipeline Design

Compressed to 8 stages per decision #7 — maps directly onto the
existing `Deal.status` enum with a thin sub-status for tracking inside
"qualified" and "contacted". No new pipeline-state tables.

| # | Stage | Deal.status | What it means |
|---|---|---|---|
| 1 | **New** | "lead" | Raw record ingested. Needs enrichment + scoring. |
| 2 | **Enriched** | "lead" | Property + owner data joined; skip-trace done (if attestations on file). |
| 3 | **Qualified** | "qualified" | Compliance Review passed. Routed to outreach. Sub-status `ready_mail` / `ready_visit` for the operator's preferred channel. |
| 4 | **Contacted** | "contacted" | Lob postcard fired OR field visit logged. Sub-status records channel. |
| 5 | **Responded** | "contacted" | Inbound reply received (Twilio inbound, email, manual call log, or owner-initiated text). Sub-status `appointment` when call/meeting scheduled. |
| 6 | **Under Contract** | "under_contract" | Offer signed. |
| 7 | **Closed** | "closed" | Deal complete. |
| 8 | **Dead** | "dead" | Operator marked the lead dead at any stage. |

### Why this compression works

The user's original 15-stage list mixed *operational sub-stages*
(needs source verification, needs enrichment, needs skip-trace) with
*pipeline-progress stages*. The 8-stage model treats the operational
gates as **automated transitions** the pipeline runs through without
the operator having to track them — the system flows from New →
Enriched as enrichment completes, and from Enriched → Qualified as
Compliance Review passes. The operator only sees the qualified-and-
above states in their main pipeline view.

### Promotion rules

- Stage 1 → 2: Enrichment + (gated) skip-trace complete; score
  computed.
- Stage 2 → 3: Compliance Review = PASS (or PASS_WITH_NOTICE for
  states with required statutory notice — e.g. MD condemnation
  cases).
- Stage 3 → 4: Lob fires (mail) or operator logs a field visit.
- Stage 4 → 5: Inbound response detected (any channel).
- Stage 5 → 6: Operator sends offer + accepts.
- Stage 6 → 7: Operator confirms close.
- Any → 8: Operator marks dead.

### Promotion rules

- Stage 1 → 2: Source-Research Agent confirms or surfaces "manual
  upload only".
- Stage 2 → 3: Enrichment Agent runs (RentCast + Realie + Smarty).
- Stage 3 → 4: Skip Trace Agent runs (gated on GLBA attestation +
  spend cap).
- Stage 4 → 5: All required enrichment present → Compliance Review
  fires automatically.
- Stage 5 → 6/7: Compliance Review = PASS or PASS_WITH_NOTICE →
  routed to Outreach Prep or Field Visit Prep based on operator's
  preferred channel.
- Stage 6/7 → 8: Operator approves the outreach piece → Lob fires
  (mail) OR operator logs the field visit (drive-by).
- Stage 8 → 9: Inbound reply detected (Twilio inbound, email reply,
  or operator logs phone callback).
- Stage 9 → 10/11/13: Manual operator decision.
- Stage 11 → 12: Operator sends offer.
- Stage 12 → 14/15: Operator marks dead or closed.

---

## 15. Lead Scoring Model

### Composition: 0-100 composite mirroring the pre_foreclosure decomposition

The user requested 5 scoring categories. Sub-signal weights sum to 100:

| Category | Sub-signal | Weight | Notes |
|---|---|---|---|
| **Violation Severity (30)** | Severity tier | 20 | Tier 1=20, Tier 2=14, Tier 3=7, Tier 4=2 |
| | Case age (open >180d = neglect signal) | 5 | Linear ramp 0→5 from 0→180 days |
| | Multiple open cases on same parcel | 5 | 1=0, 2=2, 3+=5 |
| **Owner Motivation (20)** | Absentee owner | 8 | mailing ≠ property = 8; null = 3 |
| | Out-of-state owner | 5 | Owner-mailing state ≠ property-state = 5 |
| | Entity owner (LLC / trust / estate) | 4 | Higher motivation typical |
| | Length of ownership (>10y) | 3 | Tired-owner signal |
| **Deal Potential (15)** | Estimated equity | 8 | <0%=0, 0-20%=3, 20-40%=5, >40%=8 |
| | Property type (SFR / multi-family / land) | 3 | Operator buy-box match |
| | Tax delinquency layer (compound distress) | 4 | Yes=4, no=0 |
| **Contactability (15)** | Phone confidence | 6 | High-confidence + mobile = 6 |
| | Email confidence | 4 | High-confidence = 4 |
| | Mailing address confidence (Smarty DPV) | 5 | DPV match Y=5 |
| **Risk / Compliance (20)** | State attestation on file | 6 | Yes=6 |
| | GLBA attestation on file | 4 | Yes=4 |
| | City solicitor permit on file (if required) | 4 | Yes=4 / city doesn't require=4 / required but missing=0 |
| | Fair Housing audit recent (<90d) | 3 | Yes=3 |
| | No "do-not-contact" flags | 3 | No flags=3 |
| | (penalty) Occupied property | -5 | Operator-occupied = subtract 5 |

### Recommendation thresholds
- `score ≥ 80`: **Hot lead** — operator-attention required; top of
  approval queue.
- `score 65-79`: **Strong lead** — auto-route to Outreach Prep.
- `score 45-64`: **Watchlist lead** — enrich monthly, do not draft
  outreach yet.
- `score < 45`: **Low priority** — archive without promoting to Deal.

### Implementation

Extend `lib/dealhawk/distress-score.ts` with
`codeViolationScore(input)` mirroring `preForeclosureScore`. The
`computeMotivationScore` wrapper consults the foreclosure / code-
violation specific scorer when the deal has a corresponding linked
record; otherwise falls back to the simple BASE_WEIGHTS map.

---

## 16. Compliance Checklist (pre-launch)

### Federal + universal

1. **Fair Housing audit on file** — operator confirms lead-selection
   algorithm has been audited for disparate impact by census tract.
   Re-audit quarterly.
2. **TCPA discipline** — same as pre_foreclosure (federal DNC, RND,
   internal DNC, quiet hours 9am-7pm).
3. **CAN-SPAM** for email — same as pre_foreclosure (postal address,
   one-click unsubscribe, suppression list).
4. **GLBA / DPPA attestation** on file before any skip-trace fires.
5. **Cold SMS off by default** — operator must explicitly enable
   per-state with 10DLC + RND.

### City-permit (the new gate for code-violation)

6. **Per-city solicitor permit attestation** — for each city in
   the operator's priority list that requires a permit (Cincinnati,
   Dallas, Houston, Atlanta, Orlando, Tampa, Phoenix, Memphis,
   Indianapolis, KCMO, Birmingham, Charlotte known + many more),
   operator confirms permit number + expiration on file before
   field-visit dispatch.

### Field outreach

7. **USPS mailbox prohibition** — UI blocks "place in mailbox" and
   trains operator that 18 U.S.C. § 1725 is criminal.
8. **No-Soliciting / No-Trespass observation → auto-suppress**.
9. **Front-door only** — backyard / curtilage / structures off limits.
10. **Two-party consent recording disclosure** for the 11 two-party
    states.
11. **Drone use disabled** at launch.
12. **Photo face-blur** server-side on all stored photos.

### Foreclosure cross-check (the MD-specific gate)

13. **MD condemnation cross-check** — when a code-violation lead is
    in MD and the case status is "scheduled_hearing" or
    "condemnation", the State Compliance Review Agent routes the
    lead through the PHIFA-applicability check. If PHIFA applies,
    the lead is gated through the pre_foreclosure module's
    statutory-notice + 5-day rescission flow.

### State foreclosure-rescue cross-check (universal)

14. **Cross-check trigger** — when ANY code-violation lead acquires
    a co-existing foreclosure signal (NOD recorded, lis pendens),
    the lead is auto-promoted to the pre_foreclosure module's
    per-state attestation flow.

### Documentation

15. **Audit-log retention 5 years** — visit logs, photos, opt-outs,
    permit numbers, attestations, source URLs + timestamps.

### Forbidden copy patterns (hardcoded in State Compliance Review)

Blocks:
- "We saw your code violations"
- "The city is going to demolish your house"
- "We can make the violations go away"
- "Avoid foreclosure" (when no foreclosure recorded)
- Government / agency look-alike letterhead
- "Your neighbors are watching"
- "We're working with the inspector"
- Demographic targeting language
- "Tired of code violations destroying your community" (community
  framing = race-coded)

### Required disclaimers (auto-injected)

- "I am a private real estate investor, not affiliated with any
  city, county, or government office."
- "I am not offering legal, financial, or code-compliance advice."
- HUD-counselor referral (only when the lead also has a foreclosure
  signal — otherwise omit so we don't introduce confusion).
- Opt-out mechanism per channel.

---

## 17. Outreach Templates

### Direct mail postcard (the default channel)

Same template as Section 10 leave-behind, just formatted for a 4×6
postcard front + back.

### Handwritten-style letter (operator-edited template)

Same compliant content; operator can hand-write a personalized
opening line if desired. Template still injects all required
disclaimers.

### Door-hanger leave-behind

Same content as Section 10 leave-behind, formatted for a door-handle
hanger. Removable (no adhesive), wedge-fit between door + frame.

### Phone call script

```
"Hi, this is [Name]. I'm a local home buyer. I'm calling because I
sometimes buy houses as-is, directly from owners. I noticed your
property at [address] and wanted to see if you've ever thought about
selling. No pressure either way — totally up to you. Is now a good
time to talk for a minute?"

[If yes, continue]
[If no, "Got it, take care, I'll send you my contact info in the
mail in case you change your mind."]
```

The State Compliance Review Agent does NOT auto-approve voice scripts
because they're high-improvisation. Operator-approval required per
script.

### Voicemail (when call goes to VM)

```
"Hi, this is [Name]. I'm a local home buyer. I sometimes buy houses
as-is, directly from owners. If you've ever thought about selling
your property at [address], give me a call at [phone]. No pressure.
Have a good day."
```

### Email (for warm follow-up only)

```
Subject: Following up on [Address]

Hi [Name],

Thanks for [letting me leave a note / talking on the phone] about
your property at [Address]. I wanted to circle back and see if you'd
had any time to think about it. No pressure either way.

If selling is something you'd want to explore, I'm happy to talk
about what an as-is offer would look like. If you'd prefer not to
be contacted again, just reply STOP and I'll remove you from my list.

Best,
[Operator Name]
[Company] | [Address] | [Phone]

To unsubscribe, reply STOP.
```

### SMS (only with explicit prior consent)

DEFAULT-OFF at template level. When enabled, the State Compliance
Review Agent requires:
- 10DLC registered brand + campaign
- RND scrub within 7 days of send
- DNC scrub on file
- Prior PEWC (express written consent) on the recipient
- STOP/HELP wired and tested

```
[Operator Name] from [Company]. Following up on your property at
[Address]. Reply Y if you'd like to chat about selling, STOP to opt
out. Msg & data rates may apply.
```

---

## 18. Implementation Roadmap

Three commits, each independently shippable. Each builds on the
pre_foreclosure module's existing infrastructure.

### Commit 1 — Schema + addon + scraper roster (~8-12 days)

- Prisma migration: `CodeViolationRecord` + `FieldVisitNote` tables,
  3 additive `Deal` columns. Additive; safe two-deploy.
- Addon entry `code_violation_distress` in `dealhawk_empire.addons[]`
  with the 6 new agents + 1 workflow + 15 KB entries.
- 10 new scrapers in `lib/dealhawk/county-scrapers/` (Chicago, NYC
  HPD, NYC DOB, LA, Philly, SF, Detroit, Cincinnati, Columbus,
  Baltimore County). All Socrata + ArcGIS — no scraping ToS risk.
- Source registry + city-solicitor-permit table maintained in
  `lib/dealhawk/city-solicitor-permits.ts`.
- Code Severity Dictionary in
  `lib/dealhawk/code-violation-severity.ts`.
- New sweep entry `runCodeViolationSweepForBusiness` co-runs with
  the existing pre_foreclosure sweep at the same `sweepHourLocal`.

Ships dark: `Business.config.codeViolation.enabled = false` default.

### Commit 2 — Scoring + Compliance Review + Outreach Prep (~7-10 days)

- `codeViolationScore` function in `lib/dealhawk/distress-score.ts`.
- Wire scoring into sweep + CSV import.
- State Compliance Review Agent: extend KB to include Fair Housing
  patterns + city-permit rules + MD condemnation cross-check.
- Outreach Prep Agent (code-violation flavor) — same Lob handlers
  + approval flow as pre_foreclosure.
- Per-city solicitor-permit attestation API + UI.
- Fair Housing quarterly audit reminder workflow.
- CSV import route at `/admin/businesses/[id]/code-violations/import`.

### Commit 3 — Dashboard + Field Visit + onboarding (~8-12 days)

- Main dashboard at `/admin/businesses/[id]/code-violations`:
  - Severity-tier breakdown (Tier 1-4 counts)
  - Pipeline view (15 stages)
  - Visit-list generator + route map
  - Field-visit log capture
  - Per-city source status grid
- Field Visit Prep Agent + the FieldVisitNote API.
- Onboarding walkthrough at
  `/admin/businesses/[id]/code-violations/setup` — same 8-step
  pattern as pre_foreclosure (template confirm → addon enable →
  Fair Housing audit → GLBA → city selection → city permits →
  buy-box filter → first sweep).
- Daily Deal Digest extension — auction-countdown section gets a
  sibling "Tier 1 code-violation leads added today" section.

---

## 19. Risks and Limitations

### Compliance risk (highest)

- **Fair Housing disparate-impact** is the biggest single risk for
  this module. Code violations correlate with race / national origin
  in many MSAs. A pure code-violation-targeting list will produce
  disproportionately minority-occupied outreach lists. The plan's
  mitigations:
  - Multi-factor lead selection (not code-violation alone)
  - Quarterly disparate-impact audit by census tract
  - Documented selection algorithm
  - Universal templates (no per-neighborhood variation)
  - Forbidden-pattern filter on every draft

- **Solicitor-permit exposure** — the SaaS must accurately maintain
  the city-permit table. A missed city → operator dispatched without
  permit → ordinance violation. Mitigation: ship with 30+ verified
  cities; flag every city in operator's list as "permit status
  unknown" until operator confirms.

- **MD condemnation cross-check** — narrow but real edge case where
  PHIFA can attach to a code-violation case. The State Compliance
  Review Agent must catch this and route through the foreclosure
  compliance flow.

### Data risk

- **Data quality varies extremely by city.** Excellent tier ~25-40
  cities; manual-only ~18,000+. The plan accepts this and ships CSV
  upload as the always-on fallback.

- **Severity classification gaps** — most feeds don't ship with
  severity. The Code Severity Dictionary covers the 10 launch cities;
  for operator-added cities, severity defaults to Tier 3 (Moderate)
  until operator overrides.

- **Address quality** — many violation records have only partial
  address or "complaint address" rather than parcel address. Smarty
  + Realie joining handles most cases; some records will be
  unmatchable.

- **Resolved violations linger in feeds.** The scraper filter for
  `status = OPEN` (or equivalent) must be carefully tuned per city.

### Operational risk

- **Operator confusion across two modules** — pre_foreclosure +
  code_violation share infrastructure (skip-trace, Lob, State
  Compliance Review) but have distinct surfaces. The dashboard
  must make this clear.

- **Spend creep** — Lob postcards + BatchSkipTracing across two
  modules can double an operator's monthly spend without obvious
  visibility. Surface combined spend in the existing spend-ceilings
  UI.

- **Field-visit safety** — operator drives to potentially-unsafe
  properties. The plan's mitigations (signage check, front-door
  only, no structure entry, no backyard, abort on Beware-of-Dog)
  reduce but don't eliminate this. Operator training is required.

### Scope risk

- **What this module is NOT** — not a code-compliance-as-a-service
  product (we don't help owners resolve violations); not a
  city-relationship management tool; not a wholesale-flipping
  workflow optimizer (that's the existing Wholesale Desk's job).
  It's a sourcing + outreach module that adds one signal type to
  the existing pipeline.

---

## 20. Questions — RESOLVED + OPEN

### Resolved (locked 2026-05-16)

1. ✅ **City scope** — 3-tier national strategy: 10 pre-built city
   adapters (Tier 1) + generic Socrata + ArcGIS auto-discovery
   (Tier 2, covers ~250-500 cities) + generic Accela/Tyler templates
   (Tier 3) + CSV fallback (Tier 4 — anywhere).
2. ✅ **PropStream** — Wire as recommended integration.
3. ✅ **Field-visit scope** — Full (visit list + route + leave-behind
   + field observation capture).
4. ✅ **Drone integration** — Skip at v1, future module.
5. ✅ **Photo handling** — Skip server-side face-blur; operator-
   discipline rules instead.
9. ✅ **Solicitor-permit table** — Skip the table; universal
   disclosure in the visit-list UI.
10. ✅ **CRM stages** — Compressed to 8 stages mapped onto existing
    `Deal.status` enum.
13. ✅ **Addon co-existence** — Unified `/distress-leads` dashboard;
    old `/foreclosures` URLs redirect.
14. ✅ **NEW: Field-visit surfaces extend to pre_foreclosure** —
    Yes. Shared `FieldVisitNote` table; pre_foreclosure addon's
    `extraAgents` gets a parallel Field Visit Prep Agent. Same
    State Compliance Review gate.

### Resolved with defaults (override if you want different)

6. ⚙ **Two-party-consent recording** — Default: ship the disclaimer
   text + a one-line UI advisory; recording happens on operator's
   own device. The platform does not manage audio recording itself.
7. ⚙ **City coverage onboarding** — Default: ship 10 pre-built
   Tier 1 cities + generic auto-discovery for everything else.
   Operators add new cities via the dashboard's "Add city" flow.
8. ⚙ **Fair Housing audit cadence** — Default: quarterly. Dashboard
   surfaces a reminder + status indicator when the last audit is
   older than 90 days.
11. ⚙ **PHIFA cross-check scope** — Default: Maryland only at launch
    (MD has the explicit condemnation trigger). For other states,
    "scheduled_hearing" / "condemnation_ordered" cases flag for
    operator review without auto-triggering the foreclosure
    compliance flow.
12. ⚙ **Skip-trace cap unification** — Default: $0/mo cap applies
    to both modules combined (one shared cap, not two). Operator
    raises via the existing spend-ceilings UI.

**Plan is decision-complete. Ready for review → finalization →
Commit 1 implementation.**

---

## Appendix A — Integration with existing Dealhawk surfaces

(Updated per decision #8 — unified `/distress-leads` dashboard.
Existing `/foreclosures` URLs redirect to the unified routes with
`?type=foreclosure` querystring filter.)

| Existing surface | What changes |
|---|---|
| [lib/dealhawk/distress-score.ts](lib/dealhawk/distress-score.ts) | Add `codeViolationScore()` parallel to `preForeclosureScore()`. `computeMotivationScore` continues to fall through to BASE_WEIGHTS when no decomposed scorer applies. |
| [lib/dealhawk/sourcing-sweep.ts](lib/dealhawk/sourcing-sweep.ts) | No direct change. Code violations don't flow through the buy-box-driven sweep; they have their own sweep. |
| [lib/dealhawk/foreclosure-sweep.ts](lib/dealhawk/foreclosure-sweep.ts) | Reference pattern only. Code-violation sweep is a parallel file `lib/dealhawk/code-violation-sweep.ts`. |
| [lib/workflows/scheduler.ts](lib/workflows/scheduler.ts) | Add `maybeRunCodeViolationSweep` alongside `maybeRunPreForeclosureSweep`. Same sweepHourLocal. |
| [lib/dealhawk/county-scrapers/](lib/dealhawk/county-scrapers) | Add 10 city-specific scrapers (Tier 1) + the generic Socrata adapter + the generic ArcGIS Hub adapter (Tier 2) + generic Accela/Tyler templates (Tier 3). All use the existing `CountyScraper` contract. |
| [lib/dealhawk/foreclosure-state-compliance.ts](lib/dealhawk/foreclosure-state-compliance.ts) | Reference only. Code-violation has a parallel file `lib/dealhawk/code-violation-compliance.ts` (Fair Housing rules + MD condemnation cross-check; **no city-permit logic per decision #6**). |
| **New:** [lib/dealhawk/code-violation-severity.ts](lib/dealhawk/code-violation-severity.ts) | Per-city violation-code-to-tier dictionary. |
| **MOVED:** `/admin/businesses/[id]/foreclosures` → `/admin/businesses/[id]/distress-leads` | Unified dashboard for both modules (decision #8). Old `/foreclosures` URL serves an HTTP redirect to `/distress-leads?type=foreclosure`. Operators with bookmarks don't break. |
| **MOVED:** Foreclosure dashboard nav + setup/compliance/import/filters routes | Sub-routes stay module-specific (`/distress-leads/foreclosures/compliance`, `/distress-leads/code-violations/compliance`) because the compliance flows are genuinely distinct. Old `/foreclosures/compliance` redirects to the new path. |
| **New:** `/admin/businesses/[id]/distress-leads/visits` | Unified field-visit list (decision #9) — pulls from both `CodeViolationRecord` and `ForeclosureRecord` with module filter. Visit log writes to the shared `FieldVisitNote` table. |
| **New:** Daily Deal Digest extension | One unified "Distress leads" section with Tier 1 code-violation count + auction-countdown leads, replacing the existing foreclosure-only auction-countdown section. |
| BusinessHeaderActions dropdown | Replace "Pre-Foreclosure (Dealhawk addon)" with "Distress Leads (Dealhawk)" — the unified entry point. Sub-links inside the dashboard route to module-specific surfaces. |

---

## Appendix B — Honest pricing assumptions

| Vendor | Best-known monthly | Notes |
|---|---|---|
| Socrata + ArcGIS Hub (open data) | $0 | The bulk of launch-city data. |
| Firecrawl | $19+/mo | For Accela / Tyler / custom-portal scraping. |
| BatchSkipTracing | $0.10-0.25/record | Reused from pre_foreclosure. |
| Smarty | $50-1k/mo | Reused. |
| Twilio Lookup | $0.005-0.04/call | Reused. |
| RealPhoneValidation (DNC) | $0.005-0.02/scrub | Reused. |
| OpenCorporates | Free / $79+ | Reused. |
| Lob | $0.85/postcard, $1.20/letter | Reused. |
| **PropStream** | ~$99/mo | **Wired as a recommended integration per decision #5.** Coverage opaque but useful for list-stacking — operator can overlay code-violation + tax-delinquent + vacant filters to find compound-distress properties. CSV export only (no API); operator-driven flow. |
| RentCast | $74-649/mo | Reused. |
| Realie | $50+/mo | Reused. |
| ~~AWS Rekognition (face-blur)~~ | — | **Skipped per decision #3** (operator-discipline only; no server-side CV). |

### Realistic monthly run-rate

- **Indie operator, 1-2 cities, 200 leads/mo:** ~$600/mo (BatchSkip
  + Lob dominate the spend; can be shared with pre_foreclosure)
- **Mid-stack, 4-5 cities, 2k leads/mo:** ~$1.5-2k/mo (Firecrawl +
  BatchSkip volume + Lob)
- **Production, 10+ cities, 10k leads/mo:** ~$5-8k/mo

Note that because BatchSkipTracing + Lob + Smarty are SHARED across
both modules (pre_foreclosure + code_violation), the marginal cost
of adding code-violation to an existing pre_foreclosure operator is
~30-40% of the standalone code-violation cost. This is by design.

---

## Appendix C — Source citations

- [Chicago Building Violations (Socrata)](https://dev.socrata.com/foundry/data.cityofchicago.org/22u3-xenr)
- [NYC HPD Violations](https://data.cityofnewyork.us/Housing-Development/Open-HPD-Violations/csn4-vhvf/data)
- [Los Angeles Code Enforcement Case](https://data.lacity.org/City-Infrastructure-Service-Requests/Building-and-Safety-Code-Enforcement-Case/2uz8-3tj3/data)
- [Philadelphia L&I Code Violations](https://opendataphilly.org/datasets/licenses-and-inspections-code-violations/)
- [SF DBI Notices of Violation](https://data.sfgov.org/Housing-and-Buildings/Notices-of-Violation-issued-by-the-Department-of-B/nbtm-fbw5/data)
- [Detroit Blight Violations](https://data.detroitmi.gov/datasets/blight-violations)
- [Cincinnati Code Enforcement](https://data.cincinnati-oh.gov/thriving-neighborhoods/Code-Enforcement/cncm-znd6)
- [Accela Civic Platform](https://www.accela.com/civic-platform/)
- [Tyler EnerGov Public Access](https://www.tylertech.com/solutions/energov-product-suite/public-access)
- TCPA: 47 U.S.C. § 227; FCC 47 C.F.R. § 64.1200
- CAN-SPAM: 15 U.S.C. § 7701; FTC 16 C.F.R. Part 316
- FHA: 42 U.S.C. § 3601; Texas DHCA v. Inclusive Communities Project (2015); HUD/CFPB joint statement on algorithmic targeting (April 2024)
- USPS: 18 U.S.C. § 1725 (mailbox restriction)
- Florida v. Jardines, 569 U.S. 1 (2013) (implied front-door license)
- Watchtower v. Stratton, 536 U.S. 150 (2002) (First Amendment for non-commercial canvassing)
- Maryland PHIFA: Md. Real Prop. § 7-301 et seq.
- DPPA: 18 U.S.C. § 2721
- GLBA: 15 U.S.C. § 6801
- FAA Part 107 (drone regulations) + state drone laws (TX Gov Code § 423; FL Stat. § 934.50; CA Civ Code § 1708.8)

---

*End of plan. Ready for review. Mark inline comments where you want
changes, answer the 13 open questions in §20, and we'll finalize
before implementation.*
