# Dealhawk Empire — Pre-Foreclosure Module
## Research-Backed Plan (2026-05)

This is a plan, not an implementation. It maps the design surface end-to-end so
we can review, redline, and finalize before writing code. Pricing and statutes
reflect 2026-05 best-available research — verify directly before contracting
vendors or launching outreach in any state.

---

## DECISIONS LOCKED (2026-05-16)

These 5 product decisions are confirmed and baked into the design below.
Remaining 7 are listed in §12.

| # | Decision | Locked answer | Architectural implication |
|---|---|---|---|
| 1 | State scope at launch | **All 50 states with per-state gating** | Every outreach draft routes through State Compliance Review Agent; per-state attestation flow is universal, not limited to the 6 high-risk states. |
| 2 | ATTOM data feed | **Optional integration** | ATTOM is a recommended-not-required integration. County Records Scraper Agent + CSV upload are the primary paths. PropertyRadar / Apify / Browserbase are the indie default. |
| 3 | Lob direct mail | **Recommended integration; fires when wired** | Lob added to `/admin/integrations` as recommended. Drafts always queue in `/admin/approvals`. When Lob is wired AND operator approves, real mail goes out. When Lob is not wired, drafts queue with a `Lob not configured — mail won't send` warning surfaced in the approval UI. |
| 4 | Cold SMS posture | **Default OFF** | Twilio SMS for pre-foreclosure outreach is disabled at the template level; operator must explicitly enable + complete a per-state TCPA attestation + complete 10DLC + RND scrub setup before SMS can fire. |
| 5 | Compliance counsel of record | **Optional** | KB state_compliance entries ship as best-effort statutory-notice templates with a prominent operator-acknowledgment ("This is not legal advice — review with your own counsel before use") rather than counsel-authoritative templates. Operators who do have counsel can override per-state templates with their own. |
| 6 | Skip-trace spend cap default | **$0/mo — every query requires manual approval** | Maximally cautious default. Every skip-trace call fires an ApprovalRequest before the lookup runs (mirrors the existing pattern for dangerous tools). Operator can raise the cap via the spend ceilings UI to switch to auto-fire mode. Throughput is intentionally slow at the default. |
| 8 | Wholesaler-license gating (IL/OK/PA/SC/FL) | **Attestation: <2 deals / 12-mo** | Operator attests fewer than 2 wholesale deals per rolling 12-month window per state. Module stays enabled with attestation on file. RE-license entry remains optional but recommended — when present, the wholesaler attestation is auto-satisfied. |
| 7 | Operator persona | **Existing Dealhawk operator + new-investor onboarding** | UI ships with in-line tooltips on every gating control, a mandatory first-enable walkthrough (4-5 step setup wizard covering state attestations, TCPA posture, Lob configuration, skip-trace cap, GLBA attestation), and the 15 KB entries expand to ~25 with longer hand-holding versions of foreclosure-101 / TCPA-101 / state-statute-101 / DPPA-101. Estimated +5-7 engineering days vs experienced-operator-only. |
| 9 | Auction bidding | **Out of scope for v1 — flagged as next module** | Module ends at outreach prep. Auction bidding (upset bids, deposits, sheriff sales vs trustee sales) is a separate compliance domain and a future module. The plan flags this so we don't bake conflicting assumptions in. |
| 10 | Existing template integration | **Addon mechanism** | New `BusinessTemplate.addons[]` entry — opt-in per business via re-materialization. Existing dealhawk_empire businesses are untouched until the operator enables the addon. |
| 11 | Daily-sweep timing | **Same hour as existing Dealhawk sourcing sweep** | `maybeRunPreForeclosureSweep` reuses `Business.config.sourcingBuyBox.sweepHourLocal`. No new config surface. The two sweeps run sequentially in the same scheduler tick. |
| 12 | Auction-countdown notification | **Telegram + Email if score ≥75 and auction <30 days** | New workflow `notifyAuctionImminent` fires once per lead when it crosses both thresholds (idempotent — `Deal.config.auctionAlertedAt` records the fire). Routes through existing Telegram outbound + Resend integrations. Lower-score leads roll into the Daily Deal Digest only. |

---

## 1. Executive Summary

### The opportunity

Pre-foreclosure is the single highest-value distress signal in residential REI.
A homeowner with a recorded Notice of Default or Lis Pendens is, by definition,
motivated. Lead time before auction ranges from ~3-5 months (non-judicial
states post-NOD) to 1-3 years (judicial states post-LP) — a usable acquisition
window. The signal is genuinely **public-record data**; the cost barrier is in
**collection + enrichment + compliant outreach**, not in access rights.

### What Dealhawk Empire already has

- A `dealhawk_empire` template with **14 starter agents across 4 pillars**:
  Sourcing (4), Underwriting (4), Outreach (3), Disposition (3).
- A motivation-scoring engine ([lib/dealhawk/distress-score.ts](lib/dealhawk/distress-score.ts))
  that already weights `pre_foreclosure: +40` (the highest single weight) with
  high-equity (×1.5) and long-tenure (×1.3) multipliers.
- `SourcingBuyBox` ([lib/dealhawk/sourcing-sweep.ts:35](lib/dealhawk/sourcing-sweep.ts:35))
  whose `distressSignals[]` array already lists `"pre_foreclosure"` as an
  operator-selectable value.
- Daily ingest workflow (`maybeRunDealhawkSourcingSweep` in
  [lib/workflows/scheduler.ts:438](lib/workflows/scheduler.ts:438)) gated to once
  per business per day, with provider rotation across RentCast / Axesso Zillow / Realie.
- `Deal`, `DealSignal`, `Prospect`, `ProspectStageEvent`, `BuyerProfile`, and
  `AttorneyProfile` Prisma models — most of the relational scaffolding exists.
- `dealMode` field on `Business` (research → outreach → contract) gating outreach
  behind a TCPA-compliance attestation already enforced at the runtime layer.
- Buy-box UI at `/admin/businesses/[id]/sourcing`, CSV import at
  `/admin/businesses/[id]/import-leads`, and the unified property tools
  (`property_search`, `property_distressed_search`, etc.) in tool-executor.ts.

### What's missing for pre-foreclosure-as-a-first-class-module

1. **No county-source agent.** Current Dealhawk sourcing relies on vendor
   feeds (RentCast/Axesso/Realie), which lag the public record by 1–3 weeks.
   For pre-foreclosure that lag is fatal in non-judicial states (3-5 month
   window).
2. **No document parser.** NOD / NOTS / Lis Pendens PDFs aren't extracted —
   so trustee, attorney, lender, case#, and reinstatement amount fields are
   blank even when we have the source URL.
3. **Schema gaps.** `Deal` has no `foreclosureStage`, `auctionDate`,
   `nodFilingDate`, `caseNumber`, `lenderName`, `trusteeName`,
   `reinstatementAmount`, `foreclosureDocumentUrl`. `DealSignal` has no
   auction-timeline JSON.
4. **No state-statute routing.** California § 2945, Maryland PHIFA, Illinois
   Mortgage Rescue Fraud Act, Minnesota Subd. 5b, Colorado Foreclosure
   Protection Act all trigger from the moment a foreclosure record is
   recorded — outreach without the required statutory notices is criminally
   exposed in 6+ states.
5. **No skip-trace integration.** Owner name → phone + email + mailing
   address is currently manual.
6. **No direct-mail channel.** Outreach today is Telegram / email / SMS;
   direct mail is the only TCPA-exempt channel and is the highest-response
   channel for distressed homeowners.
7. **No auction-countdown surface.** The dashboard has no "auction in N
   days" view, which is the single most decision-relevant signal for an
   operator working pre-foreclosure leads.

### The recommended build

A **pre_foreclosure addon** to the Dealhawk Empire template (delivered through
the `BusinessTemplate.addons` mechanism — opt-in per business via
re-materialization; existing dealhawk_empire businesses are untouched until
the operator enables it), consisting of:

- **6 new agents** layered into the existing 4-pillar team (3 sourcing-adjacent,
  1 enrichment, 1 compliance, 1 outreach-prep).
- **2 new Prisma tables** (`ForeclosureRecord`, `SkipTraceResult`) +
  **8 additive columns** on `Deal` and `DealSignal`.
- **3 new tool integrations** (BatchSkipTracing, Lob, optional ATTOM) +
  **a Browserbase + Apify + Firecrawl scraping bridge** for county portals.
  County-direct + CSV upload are the primary sourcing paths; ATTOM is a
  recommended-but-not-required upgrade.
- **A state-foreclosure-statute routing layer** that auto-injects the correct
  statutory notices into outreach drafts for all 50 states, with per-state
  operator attestation required before outreach fires in any state. Counsel
  of record is optional — KB ships with best-effort templates + operator-
  acknowledgment banner; counsel-reviewed templates can be substituted.
- **Cold SMS default OFF** at template level; operator must explicitly enable
  + complete 10DLC + RND + per-state TCPA attestation before any SMS fires.
- **A new dashboard surface** at `/admin/businesses/[id]/foreclosures` showing
  auction countdowns, statutory-notice readiness, skip-trace confidence, and
  outreach-channel readiness per lead.
- **15 new knowledge-base entries** on foreclosure timelines, state-by-state
  statutes, lender / trustee / attorney research methodology, skip-trace
  validation, and the required disclaimer language by channel and state.

### Build size

Roughly **25-37 engineering days** of focused work across 3 commits (revised
up from 20-30 because of persona-7 expansion to new-investor onboarding —
tooltips, walkthrough, expanded handholding KB):

1. Schema + scraping bridge + ATTOM integration + base agent wiring (~7-10 days)
2. Skip-trace + Lob + state-statute routing + compliance gates +
   manual-approval flow for every skip-trace query (~9-11 days)
3. Dashboard surface + auction-countdown + KB (~25 entries) + state
   attestation flows + first-enable walkthrough wizard + in-line tooltips
   (~9-16 days)

Each commit independently shippable behind the addon flag.

---

## 2. Recommended Strategy

### Strategy in one sentence

**Build a multi-source pre-foreclosure pipeline (county-direct scraping +
optional ATTOM + CSV upload) that feeds a per-state compliance-gated outreach
workflow, with direct mail as the default channel and SMS off until the
operator explicitly enables it per state.**

### Sequencing logic

1. **County-direct + CSV-first sourcing.** County Records Scraper Agent and
   the CSV-upload path are the primary lead sources, sized to work for an
   indie operator with no paid data feed. PropertyRadar entry tier
   (~$249/mo) is the recommended commercial supplement for CA-heavy
   operators.
2. **ATTOM is an optional integration.** When the operator wires an ATTOM
   API key, the County Records Scraper Agent uses ATTOM as the canonical
   national feed and reduces direct-scraping load on most counties. Without
   ATTOM, the agent runs all priority counties via Browserbase / Apify /
   Firecrawl + CSV upload.
3. **Direct mail (Lob) before any other outreach channel.** Direct mail is
   exempt from TCPA, lighter on CAN-SPAM analog, and the highest-response
   channel for distressed homeowners.
4. **Cold SMS default OFF.** Twilio SMS as a pre-foreclosure channel is
   disabled at template level. The operator must explicitly enable + complete
   per-state TCPA attestation + 10DLC + RND scrub setup before SMS can fire.
5. **State-statute routing across all 50 states.** Every outreach draft
   routes through the State Compliance Review Agent regardless of state.
   The 6 high-risk states (CA / MD / IL / MN / CO / NY) plus FL get the
   heaviest gating (per-state attestation required); all other states get
   the universal disclaimers + required state-specific notices when one
   exists.
6. **Compliance Review Agent as a hard gate.** Mirror the existing
   compliance-officer pattern — every outreach draft routes through a
   compliance check before queueing in `/admin/approvals`.

### Why NOT a different approach

- **Why not pure county-direct scraping?** Maintenance load is brutal —
  estimate 0.5 FTE just keeping 20+ portals working. ATTOM handles that
  upstream for ~$1k/mo.
- **Why not just PropStream?** No API. Manual export only. Doesn't fit an
  automated daily-sweep workflow. Useful as a paralegal research tool, not as
  a platform integration.
- **Why not CoreLogic / IDI / TLO?** Out of reach for indie operators until
  revenue proof + GLBA license is in place. Don't promise these to users.
- **Why not BeenVerified / Spokeo / Whitepages for skip trace?** Their TOS
  explicitly forbids commercial cold-outreach use. Settled case law
  (Spokeo v. Robins, 2016) sits adjacent. Integrate one of these and you've
  shipped a TOS violation by default.
- **Why not let agents draft cold-SMS by default?** TCPA exposure is real
  ($500-1500 per violation, class-action bait). Foreclosure-distress SMS is
  carrier-filtered as "high-risk financial" content even with PEWC. Lead
  with mail, not SMS.

---

## 3. Data Source Map

### Foreclosure regime by state (drives where to look)

Non-judicial states publish via the **county recorder** (Notice of Default →
Notice of Trustee Sale). Judicial states publish via the **court docket**
(Complaint / Lis Pendens → Judgment of Foreclosure → Notice of Sale). Hybrid
states (HI, OK, NE, SD) can go either way depending on the lender's election.

| Regime | Example states | Primary documents | Lead time (filing → auction) | Best free source |
|---|---|---|---|---|
| Non-judicial | CA, AZ, TX, GA, NV, NC, OR, WA, TN, MS, MO, MA, MI, AL, UT, ID, MT, WY, AK, NH, RI, WV | NOD → NOTS | 3-6 months | County recorder |
| Judicial | FL, NY, IL, NJ, OH, PA, IN, CT, KS, KY, DE, LA, ME, ND, SC, VT, WI, NM | Lis Pendens → Judgment → Notice of Sale | 8-36 months | County clerk court docket |
| Hybrid | HI, OK, NE, SD | Either | Variable | Both |
| Non-judicial w/ court oversight | MD | Order to Docket + Notice of Sale | ~5 months | MD Judiciary Case Search (statewide free) |

### Document types and what they signal

- **Notice of Default (NOD)** — non-judicial. Earliest non-judicial signal.
  Recorded at county recorder ~120 days post-miss (CA timing). Lead time
  ~3-5 months to auction.
- **Notice of Trustee Sale (NOTS / NTS)** — non-judicial auction notice.
  21-day lead time. Too late for soft-touch acquisition; useful for auction
  bidding.
- **Lis Pendens (LP)** — judicial. Filed at outset of lawsuit. Earliest
  judicial signal. Lead time 8-24 months.
- **Notice of Sale (judicial)** — clerk/sheriff issued after Judgment of
  Foreclosure. 30-60 day lead time.
- **Sheriff's Sale notice** — auction calendar; 2-8 week lead.
- **Judgment of Foreclosure** — court order authorizing sale. 30-90 days to
  auction.
- **Tax delinquency / tax lien** — earliest financial-distress signal,
  slow-moving (1-3+ years to tax sale).
- **Probate / divorce filings** — adjacent distress (Dealhawk already scores
  these). Not foreclosure but high-correlation distress.

### County-level access patterns (with friction notes)

1. **County recorder online search (non-judicial).** Pattern: filter by
   document type ("Notice of Trustee Sale", "Notice of Default") + date range,
   pull recorded docs. **Friction:** image-download fees ($1-5/page common),
   2-year search caps (Maricopa AZ verified), CAPTCHA + legacy ASP.NET
   portals on many small-county sites.
2. **County clerk court docket (judicial).** Civil/chancery case-search,
   filter by case-type code. **Friction:** Tyler Odyssey / Tyler Eagle /
   Justice Systems Full Court behind login or per-page fees on many counties;
   Illinois Supreme Court explicitly **forbids remote document access** —
   Cook County shows the docket but not the document.
3. **State unified court portals.** Florida ACIS + per-county clerk portals
   (free), NY NYSCEF + eCourts (free), MD Judiciary Case Search (free
   statewide). Quality varies; FL is gold standard for judicial-state
   coverage.
4. **Sheriff's office auction calendars.** Public HTML pages with weekly /
   monthly schedules. Cheap to scrape but downstream (close to auction).
5. **Public legal-notice newspapers.** State press associations aggregate
   foreclosure notices: publicnoticeads.com (multi-state), floridapublicnotices.com,
   georgiapublicnotice.com, ncnotices.com, mnpublicnotice.com,
   njpublicnotices.com, scpublicnotices.com, publicnoticepa.com,
   nevadapublicnotice.com. Critical where the recorder feed is weak. **Not
   universal coverage.**
6. **Tax assessor delinquency lists.** Annual PDFs/CSVs in many counties;
   not a foreclosure feed but feeds pre-foreclosure scoring.

### Verified high-leverage county sources

1. **Maricopa County, AZ Recorder** — free document search at
   recorder.maricopa.gov; free Title Alert sign-up.
2. **Miami-Dade Clerk of Court** — free lis pendens + foreclosure case search
   at miamidadeclerk.gov.
3. **Broward County Clerk** — free public case search at browardclerk.org.
4. **Florida ACIS** — acis.flcourts.gov/portal — multi-county aggregator.
5. **Cook County, IL Clerk** — free chancery/foreclosure docket search;
   *docket only, no documents* (IL rule).
6. **Dallas County, TX County Clerk** — free NOTS publishing at
   dallascounty.org. Texas statute requires county websites to publish NOTS
   for free.
7. **Tarrant, Travis, Kerr, Wise counties TX** — similar to Dallas.
8. **NYSCEF** — iapps.courts.state.ny.us/nyscef/CaseSearch — statewide NY
   free case search. Lis pendens themselves at county clerk (Westchester,
   ACRIS for NYC counties).
9. **Maryland Judiciary Case Search** — casesearch.courts.state.md.us —
   statewide free.
10. **California county recorders** — LA, Orange, Riverside, San Diego,
    Sacramento have web portals; some smaller counties (Alpine, Modoc, Sierra)
    are still paper/microfilm. Verify per-county.

### Aggregator alternatives (when direct isn't viable)

| Provider | Cost (verified 2026-05) | API? | Best for |
|---|---|---|---|
| **ATTOM** | API from ~$95/mo; foreclosure bundle realistically ~$1-2k/mo | **Yes** | National canonical pre-foreclosure feed; daily refresh |
| **PropertyRadar** | $59-249/mo (Team $249 with mail+API) | **Yes** | CA-heavy operators; strong phone-number accuracy |
| **PropStream** | $99/mo Essentials | **No public API** (CSV export only) | Manual paralegal research tool |
| **Foreclosure.com** | ~$39-49/mo public-facing | Limited | Older brand; mixed quality |
| **RealtyTrac** | ~$49/mo public-facing | Limited | Consumer skin on ATTOM upstream |
| **DataTree (First American)** | Custom, ~$1k+/mo enterprise | **Yes** | Production-tier alternative to ATTOM (title-chain depth) |
| **CoreLogic** | $10k+/yr enterprise entry | **Yes** | Skip unless funded |
| **Estated** | — | — | **Sunsetted** — acquired by First American 2022. Don't waste integration effort. |

### Field menu by source

| Field | Recorder (NOD/NTS) | Court (LP/Judgment) | Sheriff sale | Legal-notice newspaper | Tax delinquency |
|---|---|---|---|---|---|
| Property address | usually (via legal description) | sometimes | yes | yes | yes |
| APN / Parcel # | yes | rarely | sometimes | sometimes | yes |
| Owner / borrower name | yes (trustor) | yes (defendant) | yes | yes | yes |
| Mailing address | rarely | rarely | rarely | rarely | yes |
| Case # | n/a | yes | yes | sometimes | n/a |
| Filing/recording date | yes | yes | yes | yes | yes |
| Auction date | NTS yes / NOD no | judgment yes | yes | yes | yes |
| Trustee | yes | n/a | n/a | yes | n/a |
| Lender / beneficiary | yes | yes (plaintiff) | sometimes | sometimes | n/a |
| Plaintiff attorney | n/a | yes | sometimes | yes | n/a |
| Amount owed / reinstatement | sometimes (NOD) | yes (judgment) | yes | sometimes | yes |
| Source URL / doc # | yes | yes | yes | yes | yes |

**The field most often missing is owner mailing address.** Join to assessor
data (Regrid / ATTOM / county assessor) to fill it.

### Honest failure modes

- Paper-only counties (mostly rural) — no remote scrape; in-person pickup or
  paid abstractor.
- CAPTCHA + session-token portals (Tyler Eagle / Tyler Odyssey "Public Access"
  variants) — plan for headless browser + CAPTCHA service, or skip.
- Login-gated case-management systems — public-access variants exist but
  redact attorney-eyes-only material.
- Per-document fees on most counties ($1-5/page).
- **Illinois rule prohibits remote document access** (docket only).
- Search caps (Maricopa AZ: 2 years).
- Freshness lag (1-7 days standard; some counties longer).
- Legal-description-only properties (no street address; join via APN).
- NY judicial backlog (2+ years) — leads are *cold* by national standards.
- Mis-classified "foreclosure" case types (mortgage vs tax vs HOA vs
  partition) — filter case-type codes carefully per jurisdiction.

---

## 4. Integration Recommendations

### Scraping + browser automation

| Provider | Role in module | Cost | Notes |
|---|---|---|---|
| **Browserbase** | Primary custom-script runner for county portals (NJ, IL Cook, NY county clerks) | ~$0.10-0.20/browser-min + ~$40/mo base | Real Chrome + stealth + residential proxy add-on |
| **Apify** | Where a maintained actor exists (e.g. Zillow-foreclosure actor, Miami-Dade Clerk actor) | $49-199/mo | Don't reinvent — Apify marketplace has REI-adjacent actors |
| **Firecrawl** | Static PDF / list-page extraction for legal-notice newspapers | Free tier + $19+/mo | LLM-friendly markdown output |
| **Bright Data** | Production-tier unblocking once volume crosses ~10k req/day | $1.05/1k req Web Unlocker; $500+/mo Datasets | KYC required — skip until needed |
| **CSV manual upload** | Always-on paralegal-friendly fallback for stubborn counties | $0 | **Must ship in v1** |

**Synthesis:** Browserbase + Apify cover ~80% of accessible counties.
Firecrawl handles legal-notice aggregators. CSV upload covers everything else.
Skip Bright Data until production scale.

### Property-data + comp APIs

| Provider | Role | Cost | Notes |
|---|---|---|---|
| **ATTOM** | **Canonical pre-foreclosure feed** | ~$1-2k/mo foreclosure bundle | Verify direct at api.developer.attomdata.com |
| **RentCast** (already integrated) | AVM + rent comp; **keep** | $74-649/mo per docs | Already wired — use for valuation, not foreclosure |
| **PropertyRadar** | CA-heavy alternative or supplement | $59-249/mo (Team $249 includes API) | Strongest in non-judicial west |
| **Regrid** | Parcel polygons + ownership join layer | $0 trial / $250-1k/mo | Map layer + APN-to-address joins; **not a lead source** |
| **DataTree** | Production-tier alternative when funded | $1k+/mo | Title-chain depth ATTOM doesn't match |
| **PropStream** | Manual research, CSV ingest only | $99/mo | Never automate against — TOS forbids |
| **Melissa Property** | Enrichment only | $0.05-0.15/lookup | Not a foreclosure source |

**Synthesis:** ATTOM for foreclosure feed; RentCast for AVM (keep — already
integrated); Regrid for parcel/ownership joins.

### Skip tracing

| Provider | Role | Cost per record | Notes |
|---|---|---|---|
| **BatchSkipTracing** | **Primary** | $0.10-0.20 volume / $0.25 single | Industry standard for REI; explicit REI-marketing permissible-purpose flow |
| **Skip Genie** | Backup | $0.20-0.40 | UI-first, limited API |
| **PropStream skip add-on** | Convenience if already on PropStream | $0.12 | Resells batch-tier upstream |
| **TLO / IDI / LexisNexis** | **Avoid for indie** | $0.25-1.00 + license | Gated; PI license often required; GLBA-strict |
| **BeenVerified / Spokeo / Whitepages** | **NEVER integrate** | — | TOS forbids commercial use; FCRA case law against |
| **People Data Labs / Clearbit** | **Wrong dataset** | — | B2B; weak/empty on homeowners |
| **TruePeopleSearch** | — | — | No API; manual scraping violates TOS |

**Synthesis:** BatchSkipTracing as primary, full stop. Maintain per-query
permissible-purpose attestation log (GLBA/DPPA defense). Never wire consumer
people-search sites — TOS + FCRA risk.

### Address + phone validation (the cleanup-before-contact layer)

Pipeline order is fixed: **Smarty (address) → BatchSkipTracing (phone) →
Twilio Lookup (line type) → DNC scrub** before any outbound.

| Provider | Role | Cost |
|---|---|---|
| **Smarty (Smarty Streets)** | Address normalization, CASS, DPV | $50-1k+/mo |
| **Twilio Lookup** | Line type (mobile/landline/VoIP) — drop landlines/VoIP before SMS | $0.005-0.04/lookup |
| **RealPhoneValidation / DNCScrub** | DNC scrub, disconnected, reassigned — TCPA safe harbor | $0.005-0.02/scrub |
| **USPS Web Tools** | Free baseline | $0 (slow + rate-limited) |
| **Melissa** | Bundle alternative to Smarty | Per-call |

### Outreach delivery (compliant prep + delivery)

| Provider | Channel | Cost | Compliance | Already in app? |
|---|---|---|---|---|
| **Lob** | **Direct mail (PRIMARY)** | $0.85 postcard / $1.20 letter | TCPA-exempt; lighter CAN-SPAM analog | No — **add** |
| **Twilio SMS** | SMS after explicit consent only | $0.0083/msg + carrier; 10DLC ~$50+$4/mo | **TCPA-exposed**; foreclosure content carrier-filtered | Yes |
| **Resend** (already integrated) | Email — follow-up to responders | $20-100+/mo | CAN-SPAM compliance is mechanical | Yes |
| **Instantly** (already integrated) | Cold-email warmup — homeowners often flag | $37-97+/mo | Domain warmup discipline; weak fit for distressed homeowners | Yes |
| **GoHighLevel** (already integrated) | Full CRM bundle | $97-497/mo | Same underlying TCPA/CAN-SPAM rules | Yes |
| **Manual dialer (CallTools / Ringy)** | Outbound calls — manual-mode only | $99-300/seat | TCPA — manual click-to-dial only; never auto-dial cold | No |
| **Ringless voicemail** | — | — | **Avoid entirely** — FCC treats as TCPA call | No |

**Channel rank for distressed-homeowner outreach (safest → riskiest):**

1. **Direct mail (Lob)** — TCPA-exempt; 1-3% response in this audience.
2. **Door-knock** — TCPA-exempt; high-trust, low-volume.
3. **Cold email (Resend)** — CAN-SPAM compliant is easy; deliverability is
   poor on this audience.
4. **Cold call (manual hand-dial only)** — workable with rigorous scrub
   discipline; single ATDS slip = class action.
5. **Cold SMS** — **do not use for cold outreach.** Only post-consent.

### Supporting

| Provider | Role | Cost |
|---|---|---|
| **OpenCorporates** | LLC → UBO resolution when owner is an entity | Free tier / $79+/mo |
| **Tavily / Serper** | Web search for orphan-signal corroboration | $30-50+/mo |
| **Supabase / Postgres** | Schema host (already in app via Prisma) | Existing |

### Three stack tiers (realistic budgets)

**Cheap / 500 leads/mo (~$600/mo, but Lob dominates):**
PropertyRadar entry + RentCast (existing) + BatchSkipTracing pay-as-you-go +
Smarty free + Twilio Lookup PAYG + **Lob postcards as the only outreach
channel**.

**Mid / 5k leads/mo (~$2-3k/mo):**
ATTOM foreclosure bundle + Apify actors + Browserbase + BatchSkipTracing
volume + Smarty $50 + Twilio Lookup ~$100 + Lob primary + Twilio SMS for
consented + Resend follow-up + Supabase (existing) + optional GoHighLevel.

**Production / 50k leads/mo (~$6-12k/mo):**
ATTOM + DataTree dual-source + Bright Data Web Unlocker + BatchSkipTracing
volume + Lob at scale + Twilio at scale (full A2P 10DLC + lawyer-reviewed
consent flow) + manual-mode dialer team.

### Stack to AVOID

- **Clearbit / People Data Labs** for homeowner skip — wrong dataset.
- **BeenVerified / Spokeo / Whitepages** backend integration — TOS + FCRA.
- **Cold SMS blasts via Twilio** without 10DLC + DNC + Lookup — TCPA.
- **Auto-dial via any dialer** to non-consented numbers — TCPA.
- **Estated** — sunsetted.
- **CoreLogic / IDI / TLO** without GLBA license + revenue proof.

---

## 5. Full Agent Workflow

### Agent additions to the existing 14-agent Dealhawk team

The pre-foreclosure addon introduces **6 new agents**. Each follows the
existing Dealhawk pattern (purpose, system prompt template, tools, escalation
rules, type=specialist). All report to the existing **Distress Signal Analyst**
which is promoted to a "team lead" within the sourcing pillar.

#### 5.1 County Records Scraper Agent

- **Purpose:** Run county-portal scraping jobs against the operator's
  configured priority counties + state public-notice aggregators on a daily
  cadence. Normalizes scraped records into a uniform `ForeclosureRecord`
  shape.
- **Inputs:** `Business.config.preForeclosureCounties[]` (operator-configured
  priority county list), buy-box geographic markets, last-successful-scrape
  cursor per county.
- **Outputs:** Raw `ForeclosureRecord` rows, source URL + scrape timestamp,
  flag for failed/CAPTCHA'd jobs.
- **Tools:** `browserbase_session`, `apify_run_actor`, `firecrawl_scrape`,
  `pdf_extract` (new — wraps an LLM-OCR call for foreclosure PDFs),
  `attom_pre_foreclosure_search` (new), `web_search` (Tavily for corroboration).
- **Memory:** Stores per-county scraping cursor + recent breakage signals
  ("Maricopa CAPTCHA appeared on 2026-05-12"). Compliance reasoning stays in
  the Compliance Review Agent's memory — keep concerns separate.
- **Failure handling:** On any per-county failure, write a `LogEvent`,
  surface in dashboard, fall back to ATTOM feed for the same county. Never
  retry on CAPTCHA without operator approval (don't trigger ToS escalation).
- **Human approval checkpoints:** Operator approval required when (a) adding
  a new priority county, (b) authorizing CAPTCHA-solving spend.

#### 5.2 Foreclosure Document Parser Agent

- **Purpose:** Parse foreclosure document PDFs (NOD, NOTS, LP, Notice of
  Sale) into structured fields — trustee, attorney, lender, case#,
  reinstatement amount, auction date, legal description.
- **Inputs:** Source URL of a foreclosure document or raw PDF content from
  the scraper.
- **Outputs:** Structured `ForeclosureRecord` fields, parser confidence
  score, raw text retained for audit.
- **Tools:** `pdf_extract`, `attom_document_lookup`, `knowledge_lookup`
  (for state-specific document format references).
- **Memory:** Stores common parser failure modes per document format ("CA
  NOD format A has reinstatement on page 2 line 4"). High-importance, hot tier.
- **Failure handling:** On low-confidence parse, flag for operator review;
  do not propagate unverified fields into outreach.

#### 5.3 Skip Trace Agent

- **Purpose:** Take a `ForeclosureRecord` with owner name + property address
  and resolve phone / email / mailing-address contact info with confidence
  scoring.
- **Inputs:** Owner name, property address, APN, optionally mailing address.
- **Outputs:** `SkipTraceResult` rows with phone numbers (annotated by
  line type after Twilio Lookup), emails, mailing addresses, confidence
  score, vendor source, query timestamp.
- **Tools:** `batch_skip_trace_lookup` (new), `smarty_address_normalize`
  (new), `twilio_lookup_phone` (new — wrapping Twilio Lookup), `dnc_scrub`
  (new), `opencorporates_search` (new — when owner is an LLC).
- **Memory:** Stores high-confidence-vendor patterns ("BatchSkip returns
  wireless for property at 123 Main"). Never stores the contact data itself
  in memory (only in the SkipTraceResult table).
- **Failure handling:** On no-match, flag the lead as "ENRICHMENT_FAILED";
  do not retry within 14 days.
- **Compliance:** Per-query permissible-purpose attestation — agent must
  record purpose code ("REI investigation / property acquisition") in
  `SkipTraceResult.purposeCode` before the lookup fires. Hard requirement.
- **Human approval checkpoints:** None per-query (per-business rate limit
  enforced by budget guard); operator approval required to enable skip-trace
  for the business (gates on a GLBA/DPPA attestation similar to the existing
  TCPA attestation for `dealMode = outreach`).

#### 5.4 Lead Scoring Agent (extends existing distress-score.ts)

- **Purpose:** Compute a pre-foreclosure-specific motivation score that
  layers on top of the existing `computeMotivationScore()`. Adds foreclosure
  stage, auction-date proximity, equity estimate, lien count, and
  contactability into the final 0-100 score.
- **Inputs:** `Deal`, `ForeclosureRecord`, `SkipTraceResult`,
  `Business.sourcingBuyBox.minMotivationScore`.
- **Outputs:** Updated `Deal.motivationScore`, scoring rationale stored on
  `Deal.config.preForeclosureScoreBreakdown`.
- **Tools:** `property_value_estimate` (existing — RentCast),
  `property_comps` (existing), `knowledge_lookup`.
- **Implementation note:** Extend `lib/dealhawk/distress-score.ts` rather
  than creating a parallel scorer. Add a `pre_foreclosure_score()` function
  that composes with `computeMotivationScore()` for backward compat.
- **Failure handling:** On missing inputs, score=0 and flag
  `NEEDS_ENRICHMENT` rather than guess.

#### 5.5 State Compliance Review Agent

- **Purpose:** Gate every pre-foreclosure outreach draft against
  state-specific foreclosure statutes. Drops PASS / BLOCK + remediation per
  the existing Compliance Officer pattern.
- **Inputs:** Outreach draft, lead state, foreclosure-record timestamp,
  channel (mail/email/SMS/call), `Business.dealMode`.
- **Outputs:** PASS or BLOCK + remediation list, required statutory-notice
  injection if PASS-with-modification.
- **Tools:** `knowledge_lookup` (state-statute KB entries),
  `get_business_settings` (existing — to check operator's per-state
  attestation status).
- **Memory:** Stores per-state precedent ("CA § 2945 notice was added to all
  outreach in CA after 2026-05-15"). Hot tier.
- **Failure handling:** On any ambiguity (e.g. unclear whether NOD has been
  recorded), default to BLOCK + operator escalation.
- **Human approval checkpoints:** Hard gate — outreach in CA / MD / IL / MN /
  CO / NY / FL requires per-state operator attestation similar to TCPA.
  Without the attestation, BLOCK and surface a setup task.

#### 5.6 Outreach Prep Agent

- **Purpose:** Compose outreach drafts per channel (mail letter, postcard,
  email, SMS opt-in flow) with the right statutory notices and disclaimers
  for the lead's state, channel, and foreclosure stage.
- **Inputs:** `Deal`, `ForeclosureRecord`, `SkipTraceResult`, channel
  selection, operator's preferred voice (from `Business.brandVoice`).
- **Outputs:** `ApprovalRequest` queued for operator review, draft stored in
  `ActionRun`, channel-specific artifact (PDF for Lob, text for SMS, HTML for
  email).
- **Tools:** `lob_create_postcard` / `lob_create_letter` (new wrappers),
  `send_email` (existing — Resend), `send_sms` (existing — Twilio),
  `compliance_review` (delegates to State Compliance Review Agent),
  `knowledge_lookup` (disclaimer + voice KB entries).
- **Memory:** Tracks operator-corrected drafts ("operator changed 'urgent'
  to 'soon' in mailers — keep that"). Warm tier.
- **Failure handling:** If State Compliance Review Agent returns BLOCK,
  surface to operator with the remediation list rather than auto-rewriting.
- **Human approval checkpoints:** Hard gate — every outreach draft queues
  through `/admin/approvals` regardless of `autoApproveExternalActions`
  setting. Pre-foreclosure overrides the auto-approve flag because the
  state-statute exposure is too high to auto-fire.

### Workflow orchestration (daily cadence)

The existing `maybeRunDealhawkSourcingSweep` is extended to additionally run
a `maybeRunPreForeclosureSweep`, also once-per-business-per-day, gated on a
new `Business.config.preForeclosure.enabled` flag.

```
06:00 local time
  └─ County Records Scraper Agent fires (parallel jobs per priority county)
       └─ Apify / Browserbase / Firecrawl jobs run
       └─ Raw foreclosure-record rows written

06:30 local time
  └─ Foreclosure Document Parser Agent processes new rows
       └─ Structured fields populated, low-confidence parses flagged

07:00 local time
  └─ Skip Trace Agent processes parsed records (rate-limited; budget-guarded)
       └─ SkipTraceResult rows written; Twilio Lookup runs; DNC scrub runs

07:30 local time
  └─ Lead Scoring Agent (extended distress-score.ts) runs
       └─ Deal.motivationScore updated
       └─ Threshold-gated leads create Prospect rows

08:00 local time
  └─ Distress Signal Analyst (existing) reviews top-N leads
       └─ Calls Outreach Prep Agent on qualified leads
       └─ Outreach Prep Agent invokes State Compliance Review
       └─ Approved drafts queued in /admin/approvals

Daily Deal Digest (existing) — extended to include
  - "auction in N days" countdown for hottest leads
  - new-foreclosure-record count for the day
  - skip-trace conversion rate
  - compliance-blocked outreach count + reasons
```

### Promotion path through the pillars

```
Foreclosure record discovered
  → Scoring + skip-trace enrichment
  → Underwriting pillar (Comp Analyst + MLS Stale Listings Agent layer-in market context)
  → Outreach pillar (Outreach Prep + State Compliance Review)
  → Operator approves
  → Lob mailer / consented-SMS / manual call queued
  → Response → Seller Motivation Interviewer (existing)
  → Pitch Architect (existing) drafts offer
  → Sub-To Qualifier / Wholesale Desk routes to exit strategy
```

---

## 6. Knowledge Base Outline

15 new KB entries, layered alongside the existing 19 (12 HMHW operational +
7 creative-finance playbook). All entries tier=warm by default, assigned to
the relevant new agents, with `state_compliance_*` entries tier=hot for the
State Compliance Review Agent.

| # | KB title | Category | Tier | Assigned agents |
|---|---|---|---|---|
| 1 | Foreclosure 101 — judicial vs non-judicial, full timeline by regime | processes | warm | All sourcing + outreach agents |
| 2 | Pre-foreclosure document reference (NOD, NOTS, LP, Notice of Sale, etc.) | processes | warm | Document Parser, Outreach Prep |
| 3 | County recorder research methodology (how to read a recording) | processes | warm | County Scraper, Document Parser |
| 4 | State-by-state foreclosure regime map (table + lead times) | processes | warm | All agents |
| 5 | California Civil Code §§ 1695 / 2945 — what triggers, required notices, rescission | state_compliance | hot | State Compliance Review, Outreach Prep |
| 6 | Maryland PHIFA — full statutory notice verbatim, 5-day rescission, criminal exposure | state_compliance | hot | State Compliance Review, Outreach Prep |
| 7 | Illinois Mortgage Rescue Fraud Act + IL wholesaler-license note | state_compliance | hot | State Compliance Review, Outreach Prep |
| 8 | Florida HB 1495 / Foreclosure Rescue Fraud Prevention Act | state_compliance | hot | State Compliance Review, Outreach Prep |
| 9 | Minnesota Subd. 5b + Colorado FPA — felony exposure summary | state_compliance | hot | State Compliance Review, Outreach Prep |
| 10 | New York RPL § 265-a Home Equity Theft Prevention Act | state_compliance | hot | State Compliance Review, Outreach Prep |
| 11 | TCPA + 10DLC discipline for REI — manual dialing, RND, DNC, quiet hours | compliance | hot | Outreach Prep, State Compliance Review |
| 12 | CAN-SPAM checklist — required elements, opt-out, physical address | compliance | warm | Outreach Prep |
| 13 | DPPA / GLBA permissible-purpose framework for skip trace | compliance | hot | Skip Trace, State Compliance Review |
| 14 | Skip-trace confidence-scoring methodology | processes | warm | Skip Trace, Lead Scoring |
| 15 | Required disclaimer language library — per channel + per state | brand_voice | hot | Outreach Prep |

Each entry is 400-1500 words of agent-ready prose. Critical: state_compliance
entries store the **verbatim statutory notice** required by each state, so
the Outreach Prep agent can inject it without paraphrasing. State legislatures
edit this language frequently — the entries must include a `legalReviewedAt`
metadata field and surface in the dashboard when older than 12 months.

---

## 7. Database Schema

Two new Prisma tables. Eight additive columns on existing tables. All
additive (no destructive migrations); compatible with the additive-migration
deploy pattern Dealhawk has been using.

### New: `ForeclosureRecord`

```prisma
model ForeclosureRecord {
  id                      String    @id @default(cuid())
  businessId              String
  dealId                  String?   // null until promoted to a Deal

  // Identity
  propertyAddress         String
  propertyAddressNormalized String? // post-Smarty
  apn                     String?
  county                  String
  state                   String

  // Foreclosure detail
  foreclosureStage        String    // "lis_pendens" | "notice_of_default" | "notice_of_trustee_sale" | "judgment_of_foreclosure" | "notice_of_sale" | "sheriffs_sale" | "auction_scheduled" | "post_sale_redemption"
  documentType            String    // "NOD" | "NOTS" | "LP" | "JF" | "NS" | ...
  filingDate              DateTime
  auctionDate             DateTime?
  caseNumber              String?

  // Parties
  ownerName               String
  ownerMailingAddress     String?
  ownerOccupied           Boolean?  // null = unknown
  trusteeName             String?
  trusteeContact          String?
  lenderName              String?
  plaintiffAttorney       String?

  // Financial (when disclosed)
  reinstatementAmount     Decimal?
  judgmentAmount          Decimal?
  estimatedEquity         Decimal?
  estimatedPropertyValue  Decimal?
  loanBalanceEstimate     Decimal?

  // Source
  sourceType              String    // "county_recorder" | "court_docket" | "sheriff_calendar" | "legal_notice" | "attom_feed" | "csv_import" | "manual"
  sourceUrl               String?
  sourceDocumentUrl       String?   // direct link to the PDF if available
  sourceTimestamp         DateTime  // when WE saw it
  parserConfidence        Float?    // 0-1
  parserRawText           String?   @db.Text

  // Workflow state
  enrichmentStatus        String    @default("pending") // "pending" | "enriched" | "failed" | "stale"
  enrichmentAttempts      Int       @default(0)
  scoreSnapshot           Int?      // 0-100 at time of last scoring

  // Soft delete + timestamps
  deletedAt               DateTime?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  business                Business  @relation(fields: [businessId], references: [id])
  deal                    Deal?     @relation(fields: [dealId], references: [id])
  skipTraceResults        SkipTraceResult[]

  @@index([businessId])
  @@index([businessId, auctionDate])
  @@index([businessId, foreclosureStage])
  @@index([state, filingDate])
  @@unique([businessId, sourceType, sourceUrl, filingDate])
}
```

### New: `SkipTraceResult`

```prisma
model SkipTraceResult {
  id                  String    @id @default(cuid())
  foreclosureRecordId String?
  dealId              String?
  businessId          String

  // Query inputs (audit trail)
  queryOwnerName      String
  queryAddress        String
  queryApn            String?
  purposeCode         String    // GLBA/DPPA permissible-purpose attestation
  purposeNotes        String?

  // Vendor
  vendor              String    // "batch_skip" | "skip_genie" | "propstream" | "manual"
  vendorRequestId     String?
  vendorRawResponse   Json?

  // Results
  phones              Json      // [{ number, lineType, dncStatus, confidence, source }]
  emails              Json      // [{ address, confidence, source }]
  alternateAddresses  Json      // [{ address, confidence, source }]
  confidenceOverall   Float     // 0-1
  isOwnerOccupied     Boolean?  // inferred from mailing address vs property

  // Cost tracking
  costCents           Int?

  // Timestamps
  queriedAt           DateTime  @default(now())
  staleAfter          DateTime  // queriedAt + 90 days typical

  // Soft delete
  deletedAt           DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  foreclosureRecord   ForeclosureRecord? @relation(fields: [foreclosureRecordId], references: [id])
  deal                Deal?     @relation(fields: [dealId], references: [id])
  business            Business  @relation(fields: [businessId], references: [id])

  @@index([businessId])
  @@index([foreclosureRecordId])
  @@index([dealId])
}
```

### Additive columns on existing tables

**`Deal`** — add:
- `foreclosureStage String?` — mirrors ForeclosureRecord for fast filter
- `auctionDate DateTime?`
- `nodFilingDate DateTime?`
- `caseNumber String?`
- `lenderName String?`
- `trusteeName String?`
- `reinstatementAmount Decimal?`
- `foreclosureDocumentUrl String?`

**`DealSignal`** — add (the model already has `signalType`, `sourceType`,
`sourceRef`; just add):
- `auctionTimelineJson Json?` — captures the full foreclosure-stage transitions
- `documentParserConfidence Float?`

**`Business.config`** — JSON-only additions (no migration needed):
- `preForeclosure: { enabled: boolean, priorityCounties: string[],
  attestations: { ca?: boolean, md?: boolean, il?: boolean, mn?: boolean,
  co?: boolean, ny?: boolean, fl?: boolean }, glbaAttestation: { signedAt:
  string, signedBy: string } }`

### Indexing strategy

- `ForeclosureRecord(businessId, auctionDate)` — drives the auction-countdown
  dashboard query.
- `ForeclosureRecord(businessId, foreclosureStage)` — drives pipeline views.
- `ForeclosureRecord(state, filingDate)` — drives cross-business analytics
  for the Master Agent.
- `SkipTraceResult(businessId, queriedAt)` — drives the budget-guard rate
  limit on skip-trace calls.

### Retention

Apply the existing retention sweep (`lib/workflows/retention-sweep.ts`):

- `ForeclosureRecord`: 730 days (longer than the 365d Message default
  because foreclosure cases run multi-year).
- `SkipTraceResult`: **5 years (1825 days)** — DPPA/GLBA defense requires
  the longer window.

---

## 8. Lead Scoring Model

### Composition with existing `computeMotivationScore`

Today, [lib/dealhawk/distress-score.ts](lib/dealhawk/distress-score.ts) scores
`pre_foreclosure: +40` as a single signal. The new model decomposes that 40
into multiple sub-signals so a lead in NOD-recorded + auction-30-days +
high-equity scores meaningfully higher than NOD-recorded + auction-180-days
+ unknown-equity.

The function signature:

```ts
function preForeclosureScore(record: ForeclosureRecord, skip: SkipTraceResult | null, valuation: PropertyValuation | null): {
  total: number;       // 0-100
  breakdown: Record<string, number>;
  recommendation: "drop" | "watch" | "outreach_ready" | "auction_critical";
};
```

### Sub-signal weights (sum to 100)

| Sub-signal | Weight | Notes |
|---|---|---|
| **Foreclosure stage** | 25 | LP=10, NOD=20, NOTS=25, Judgment=20, Notice of Sale=15 (lower late-stage because lead time too short to acquire pre-auction in most states) |
| **Auction-date proximity** | 15 | >180d=5, 60-180d=10, 30-60d=15, <30d=12, <14d=8 (steep dropoff inside 14d because of statutory holds and trustee finality) |
| **Equity estimate** | 15 | <0% (underwater)=0, 0-20%=5, 20-40%=10, >40%=15 |
| **Owner occupied** | 8 | Occupied=8, absentee=4, unknown=2 (occupied = stronger statutory protections AND stronger motivation to act) |
| **Length of ownership** | 5 | >10yr=5, 5-10yr=3, <5yr=1 (long tenure = more equity AND more emotional investment) |
| **Tax delinquency layer** | 5 | Yes=5, no=0 (compound distress) |
| **Property value tier** | 5 | Operator's buy-box minPrice ≤ value ≤ maxPrice=5, outside=0 |
| **Contactability** | 10 | High-confidence phone+email+mailing=10, partial=4, none=0 |
| **Compliance posture** | 7 | All required state attestations in place=7, missing one=4, missing critical=0 — penalizes leads we can't legally pursue |
| **Multi-source corroboration** | 5 | Two or more sources confirming the same filing=5, single source=2 |

### Recommendation thresholds

- `score >= 75`: **`auction_critical`** — operator-attention required;
  bump into top of approval queue.
- `score 55-74`: **`outreach_ready`** — auto-route through Outreach Prep
  with compliance gating.
- `score 35-54`: **`watch`** — enrich monthly, do not draft outreach yet.
- `score < 35`: **`drop`** — archive to ForeclosureRecord without
  promoting to Deal.

### Integration with existing motivation score

The pre-foreclosure score **replaces** the +40 pre_foreclosure entry in
`computeMotivationScore` when the lead has an associated `ForeclosureRecord`.
Otherwise the existing +40 flat weight is used. This keeps backward compat
for leads sourced via non-foreclosure paths (probate / divorce / absentee /
tax delinquency).

Implementation: wrap `computeMotivationScore` so it consults
`ForeclosureRecord` first; if present, use `preForeclosureScore`; otherwise
fall through to the existing signal-list logic.

---

## 9. Compliance Checklist (pre-launch)

This is the operator-attestation gate the State Compliance Review Agent
enforces. The system **must not** allow outreach to fire on a lead in any
of the 7 high-risk states until the operator has completed each item.

### Federal

1. Federal DNC subscription active; scrub cadence ≤31 days.
2. Reassigned Numbers Database account active; pre-call scrub within 7
   days.
3. Internal DNC list integrated across all channels.
4. 10DLC brand + campaign registered with The Campaign Registry; STOP/HELP
   wired; carrier approval received (only required if SMS will be used;
   recommended to leave SMS off by default).
5. CAN-SPAM physical postal address on every email; one-click unsubscribe;
   suppression list synced ≤24h.
6. Dialing system confirmed **non-ATDS** (manual click-to-dial only);
   written vendor attestation on file.
7. DPPA/GLBA permissible-purpose attestation signed by operator; per-query
   purpose code captured.
8. Recording-consent logic per state (two-party-consent states: CA, CT,
   FL, IL, MD, MA, MT, NV, NH, PA, WA).
9. Quiet-hours enforcement uses **recipient local time** (area code + ZIP,
   more conservative wins). 8am-9pm federal; 8am-8pm FL.

### State-specific (gates per-state activation — ALL 50 STATES)

Every state requires the operator to complete a per-state attestation before
outreach can fire for leads in that state. The 7 below carry the heaviest
statutory exposure (criminal liability in 5 of them) and ship with the
deepest KB entries. Remaining 43 states ship with universal disclaimers +
their specific statutory notice when one exists; the operator attestation
serves as the operator's acknowledgment that they've reviewed the template
(and, if they have counsel, optionally substituted counsel-reviewed
language).

10. **California (Civ. Code § 1695 / § 2945)** — 5-day rescission; no
    upfront fees; § 2945 felony exposure for non-compliance. Required.
11. **Maryland (PHIFA RP § 7-301 et seq.)** — 5-day rescission; criminal
    exposure up to 5 yrs / $25K.
12. **Illinois (Mortgage Rescue Fraud Act 765 ILCS 940 + 225 ILCS 454/5-32
    wholesaler license)** — 5-day rescission; wholesaler license OR
    attestation of fewer than 2 deals/12-mo.
13. **Minnesota (§ 325N.10 / Subd. 5b)** — 5-business-day rescission;
    14-pt bold notice template; felony for material violations.
14. **Colorado (FPA C.R.S. § 6-1-1101)** — 5-day rescission; $1,500 per
    violation civil statutory damages.
15. **New York (RPL § 265-a Home Equity Theft Prevention Act)** — 5-day
    rescission; civil + criminal.
16. **Florida (Ch. 501.1377)** — 3-day rescission; FDUTPA exposure;
    potential 3rd-degree felony for fraudulent transfer.
17. **All other 43 states + DC** — operator-attestation that the
    operator has reviewed the ship-default statutory notice template (or
    substituted their own counsel-reviewed version) and accepts
    responsibility for state-specific compliance. The template ships
    with the universal disclaimers + HUD-counselor referral + applicable
    state-specific notice where one exists (e.g. WA equity skimming,
    GA fair business practices, MO foreclosure consultant act, NV NRS
    645F, OR ORS 646A.730, MA AG Foreclosure Rescue regs, AZ HB 2766,
    MI MCL 445.1822, NC, RI, VA).

### Counsel-of-record posture (decision #5 — counsel OPTIONAL)

Each state_compliance KB entry ships as a **best-effort statutory-notice
template** with the verbatim statutory language pulled from current state
code, plus a prominent operator banner:

> "This is not legal advice. Review with your own counsel before use.
> If you have counsel-reviewed language for this state, substitute it via
> the per-state template override in /admin/businesses/[id]/foreclosures/compliance."

Operators with retained counsel can paste counsel-reviewed templates per
state. Operators without counsel use the ship-default with the disclaimer
visible to themselves (operator-facing only — never in the consumer
mailer). State legislatures move quarterly; KB entries surface in the
dashboard when older than 12 months for operator re-review.

### Operational

17. FHA targeting audit complete — no demographic proxies in lead scoring;
    documented disparate-impact test on the pre-foreclosure scoring weights.
18. Required disclaimers ("I am a private real estate investor, not a
    lender / attorney / agent / government rep") in every channel template.
19. HUD-counselor phone number (1-800-569-4287) in outreach to foreclosure-
    recorded homeowners.
20. Equity-purchase contract templates jurisdiction-specific with statutory
    rescission language.
21. E&O + cyber-liability + class-action TCPA endorsement on insurance.
22. DPIA / privacy-policy update covering CCPA/CPRA, CO Privacy Act, VA
    CDPA, CT, UT, TX, OR, MT, IA, DE, TN, FL — homeowner PII is "sensitive"
    in several states.
23. Counsel sign-off dated within 90 days of launch.

### Forbidden copy patterns (hardcoded in State Compliance Review Agent)

The agent **BLOCKS** any outreach draft containing:

- "URGENT: Foreclosure Notice" or any government-impersonation pattern
- "Government Program Available" / "HUD" / "HAMP" / "HARP" / federal-program
  references
- "We can stop your foreclosure"
- "Your lender has authorized us to contact you"
- "Limited time — respond within 24 hours" (artificial urgency)
- Implied licensure / counseling status
- Look-alike official letterhead

### Safe copy patterns (KB entry #15)

- "I saw a public foreclosure filing on your property…"
- "I am a private real estate investor and not affiliated with your lender…"
- "I am not offering legal or financial advice."
- "You have the right to speak with a HUD-approved housing counselor for
  free at 1-800-569-4287 or hud.gov/findacounselor."
- State-specific statutory notice (verbatim, post-NOD only) injected by
  the State Compliance Review Agent.

---

## 10. Implementation Roadmap

Three commits, each independently shippable. Estimated ~20-30 engineering
days total. Aligns with the existing Dealhawk additive-migration pattern.

### Commit 1 — Schema + ATTOM + scraping bridge + base agents (~7-10 days)

- Prisma migration: add `ForeclosureRecord`, `SkipTraceResult`, additive
  columns on `Deal` and `DealSignal`. All additive; safe two-deploy.
- Add ATTOM integration to `/admin/integrations` (recommended, not required).
- Wire `attom_pre_foreclosure_search`, `attom_document_lookup` tools in
  tool-executor.ts.
- Browserbase + Apify + Firecrawl tool wrappers in tool-executor.ts.
- Add **County Records Scraper Agent** and **Foreclosure Document Parser
  Agent** to the dealhawk_empire template.
- Extend `maybeRunDealhawkSourcingSweep` to also call
  `maybeRunPreForeclosureSweep` (gated on `Business.config.preForeclosure.enabled`).
- CSV upload path at `/admin/businesses/[id]/foreclosures/import`.

**Ships dark** — `preForeclosure.enabled = false` by default for all
businesses. No user-visible behavior change.

### Commit 2 — Skip trace + Lob + state-statute routing + compliance gates (~8-10 days)

- BatchSkipTracing + Smarty + Twilio Lookup + RealPhoneValidation tool
  wrappers.
- OpenCorporates wrapper for LLC-owner resolution.
- Lob integration as a new `/admin/integrations` entry (recommended).
- Add **Skip Trace Agent**, **State Compliance Review Agent**, **Outreach
  Prep Agent** to the template.
- KB entries 1-15 from §6 above, with state_compliance entries in hot tier.
- Per-state attestation flow at `/admin/businesses/[id]/foreclosures/compliance`
  — operator signs each state-specific notice; system stores
  `Business.config.preForeclosure.attestations` map.
- Extend the existing dealMode TCPA-attestation pattern: a new
  `preForeclosure.glbaAttestation` for skip trace.
- Outreach Prep Agent hard-gated to route every draft through Approval
  regardless of `autoApproveExternalActions`.

**Still ships dark** — operators must explicitly enable the addon at the
template level.

### Commit 3 — Dashboard + auction-countdown + scoring + KB + UI polish (~5-10 days)

- New dashboard surface at `/admin/businesses/[id]/foreclosures`:
  - Auction-countdown view (sorted by `auctionDate ASC`, color-coded
    bands)
  - Compliance-readiness widget per state (green/yellow/red)
  - Skip-trace conversion funnel
  - Outreach approval queue (filtered to pre-foreclosure)
- Buy-box UI extended at `/admin/businesses/[id]/sourcing` to add
  pre-foreclosure-specific controls (state allowlist, document-type
  filter, auction-date window).
- Extend `lib/dealhawk/distress-score.ts` with `preForeclosureScore()`.
- Add **Lead Scoring Agent** wiring (calls `preForeclosureScore` during
  the daily sweep).
- Daily Deal Digest extended with the new auction-countdown section.
- KB entries deployed; legalReviewedAt metadata on state_compliance entries.

**Enables the module.** After commit 3, operators can flip
`preForeclosure.enabled = true` per business, complete the state
attestations they need, and start using the workflow.

### Migration safety

All migrations additive. Retention sweep extended to clean
`ForeclosureRecord` and `SkipTraceResult` per §7. State attestations live in
`Business.config` (JSON) — no schema migration needed when new states are
added later.

### Test plan per commit

- Commit 1: ATTOM integration smoke test against operator's API key;
  Browserbase smoke test against Maricopa AZ; CSV import golden-path test;
  scoring agent test with synthetic ForeclosureRecord.
- Commit 2: BatchSkipTracing smoke against test account; State Compliance
  Review Agent unit test (every state-statute KB entry must produce a
  reasoned PASS / BLOCK / PASS-with-modification on synthetic drafts);
  per-state attestation flow walkthrough.
- Commit 3: Dashboard render with synthetic data spanning all foreclosure
  stages; scoring extension regression test against existing
  computeMotivationScore behavior.

---

## 11. Risks and Limitations

### Compliance risk (biggest)

- **State-foreclosure-statute exposure** — CA / MD / IL / MN / CO carry
  criminal liability. The state attestation gating must be airtight; a
  single mis-routed draft in CA is a felony under § 2945.7.
- **TCPA exposure** — particularly cold SMS. Default SMS off; require
  per-business opt-in with PEWC gate. RND scrubbing must be enforced.
- **Equity-purchaser vs foreclosure-consultant boundary** — the agent's
  drafts must never imply foreclosure-prevention services or government
  affiliation. The KB and BLOCK list must be exhaustive.
- **Wholesaler-license exposure in IL / OK / PA / SC / FL** — operators
  marketing pre-foreclosure leads to a buyer's list need attestation.

### Data risk

- **County portal volatility** — Tyler Eagle / Odyssey portals change UI
  quarterly. Maintenance burden on the County Scraper Agent. Budget
  ongoing engineering time for portal upkeep.
- **ATTOM lag** — vendor feed is 24-72h fresher than recorder filings in
  most counties but lags 1-3 days vs direct scrape. For non-judicial state
  short-window deals (CA NOTS), direct scrape matters.
- **Skip-trace accuracy** — single-source skip trace is 50-70% accurate at
  best. Confidence scoring + multi-source corroboration is essential.
  Operator expectations need framing.
- **Probate / divorce as distress signals** — already in Dealhawk via
  signal weights, but the pre-foreclosure module shouldn't double-count.

### Operational risk

- **Operator confusion about which states are "live"** — the State
  Compliance Review Agent must surface clearly which states are gated and
  why. Don't bury this in settings.
- **Approval-queue overload** — at 5k leads/mo with 20% qualifying, that's
  1k approvals/mo. The operator may want batch-approval UX. Plan for it.
- **Lob cost surprise** — $0.85/postcard × 1k/mo = $850/mo just on mail.
  Surface spend ceilings prominently.
- **Compliance update cadence** — state legislatures move quarterly. KB
  entries must surface when older than 12 months for re-review.

### Scope risk

- **What this module is NOT:** a foreclosure-prevention service; an
  equity-purchase contract generator (for now — that's a future module
  that requires per-state legal templates); an auction bidding tool; a
  loan-modification assistant; a tax-lien investing tool. Each of those
  is a separate compliance domain.

---

## 12. Questions — RESOLVED + OPEN

### All resolved (locked 2026-05-16)

1. ✅ **State scope:** All 50 states with per-state gating.
2. ✅ **ATTOM:** Optional integration.
3. ✅ **Lob:** Recommended integration; drafts queue, fires when wired.
4. ✅ **Cold SMS:** Default OFF; per-state operator opt-in required.
5. ✅ **Compliance counsel:** Optional; KB ships with best-effort templates
   + operator-acknowledgment banner.
6. ✅ **Skip-trace cap:** $0/mo default — every skip-trace requires manual
   approval. Operator can raise via spend ceilings UI.
7. ✅ **Persona:** Existing operator + new-investor onboarding. Adds
   tooltips, mandatory first-enable walkthrough, expanded handholding KB
   entries.
8. ✅ **Wholesaler-license:** Attestation of <2 deals / 12-mo per state in
   IL/OK/PA/SC/FL. RE-license entry optional but auto-satisfies attestation.
9. ✅ **Auction-bidding scope:** Out of scope; flagged as next module.
10. ✅ **Addon mechanism:** New `BusinessTemplate.addons[]` entry, opt-in
    per business.
11. ✅ **Sweep timing:** Same hour as existing Dealhawk sourcing sweep.
12. ✅ **Auction notification:** Telegram + Email when score ≥75 AND
    auction <30 days. Lower-score leads roll into Daily Deal Digest only.

**Plan is decision-complete. Ready for review → finalization → implementation.**

---

## Appendix A — Integration with existing Dealhawk surfaces

This module isn't a separate template; it slots into the existing
dealhawk_empire team and dashboard. Touchpoints:

| Existing surface | What changes |
|---|---|
| [lib/dealhawk/distress-score.ts](lib/dealhawk/distress-score.ts) | Add `preForeclosureScore()` that composes with `computeMotivationScore()`. Pre-foreclosure leads route through the new scorer; non-foreclosure leads use existing logic. |
| [lib/dealhawk/sourcing-sweep.ts](lib/dealhawk/sourcing-sweep.ts) | `SourcingBuyBox.distressSignals[]` already includes `pre_foreclosure`. Extend with `preForeclosureFilters` sub-object (state allowlist, document types, auction-date window). |
| [lib/workflows/scheduler.ts](lib/workflows/scheduler.ts) `maybeRunDealhawkSourcingSweep` | Add `maybeRunPreForeclosureSweep` invocation alongside. Same once-per-business-per-day gating. |
| [app/admin/businesses/[id]/sourcing/page.tsx](app/admin/businesses/[id]/sourcing/page.tsx) | Buy-box UI extended with pre-foreclosure filters when `Business.config.preForeclosure.enabled = true`. |
| [app/admin/businesses/[id]/import-leads/page.tsx](app/admin/businesses/[id]/import-leads/page.tsx) | CSV importer extended to accept pre-foreclosure-specific fields (NOD date, auction date, case#, lender). |
| **New:** `/admin/businesses/[id]/foreclosures` | Auction countdown + pipeline view + skip-trace funnel + approval queue. |
| **New:** `/admin/businesses/[id]/foreclosures/compliance` | Per-state attestation flow. |
| **New:** `/admin/businesses/[id]/foreclosures/import` | Pre-foreclosure CSV import (separate from the existing general lead import). |
| Daily Deal Digest workflow (existing) | Add auction-countdown section + new-record count + compliance-blocked count. |
| Existing 14 starter agents | No prompt edits — the new 6 agents slot in alongside. The Distress Signal Analyst's prompt should reference the new sub-agents. |
| Existing buy-box config UI | Already supports `pre_foreclosure` as a distress signal value — the new filters extend it, not replace it. |

---

## Appendix B — Honest pricing assumptions (2026-05)

All prices are best-known at 2026-05 and should be verified by the operator
before contracting. Some vendors change tier structure quarterly.

| Vendor | Best-known monthly | Pay-per-use | Notes |
|---|---|---|---|
| ATTOM foreclosure bundle | ~$1-2k/mo | Per-call tiers above | Verify direct |
| PropertyRadar Team (incl. API) | ~$249/mo | — | CA-strong |
| PropStream | $99/mo | + skip add-on | Manual only |
| BatchSkipTracing | — | $0.10-0.25/record | Volume discount |
| Browserbase | $40+ base | $0.10-0.20/browser-min | Residential proxies extra |
| Apify | $49-199/mo | Compute units | Marketplace actors |
| Firecrawl | Free / $19+ | — | Static pages |
| Smarty | $50-1k+/mo | — | Address normalization |
| Twilio Lookup | — | $0.005-0.04/call | Line type |
| Lob | — | $0.85 postcard / $1.20 letter | Mail |
| OpenCorporates | Free / $79+ | — | LLC resolution |
| Tavily | $30+/mo | — | Agent-friendly search |

### Realistic monthly run-rate at three volume tiers

- **Indie operator, 500 leads/mo:** ~$600/mo (Lob dominates the spend)
- **Solid mid-stack, 5k leads/mo:** ~$2.5-3.5k/mo
- **Production, 50k leads/mo:** ~$8-12k/mo

The cost is mostly downstream (skip trace + mail), not upstream (data feed
+ scraping). Plan budget around outreach volume, not data acquisition.

---

## Appendix C — Source citations

Research base for this plan:

- Nolo: Judicial vs Nonjudicial Foreclosure (https://www.nolo.com/legal-encyclopedia/chart-judicial-v-nonjudicial-foreclosures.html)
- Nolo: 50-State Foreclosure Law Chart (https://www.nolo.com/legal-encyclopedia/50-state-chart-key-aspects-state-foreclosure-law.html)
- Maricopa County Recorder (recorder.maricopa.gov), Miami-Dade Clerk
  (miamidadeclerk.gov), Broward Clerk (browardclerk.org), Florida ACIS
  (acis.flcourts.gov), Cook County Clerk (cookcountyclerkofcourt.org),
  Dallas County Clerk (dallascounty.org), NYSCEF
  (iapps.courts.state.ny.us/nyscef/CaseSearch), Maryland Judiciary Case
  Search (casesearch.courts.state.md.us)
- ATTOM API (api.developer.attomdata.com), PropertyRadar
  (propertyradar.com), PropStream (propstream.com)
- BatchSkipTracing (batchskiptracing.com), Smarty (smarty.com), Twilio
  Lookup (twilio.com/docs/lookup), Lob (lob.com), OpenCorporates
  (opencorporates.com)
- TCPA: 47 U.S.C. § 227; FCC 47 C.F.R. § 64.1200; Facebook v. Duguid
  (2021); IMC v. FCC 11th Cir. (Jan 2025)
- CAN-SPAM: 15 U.S.C. § 7701; FTC 16 C.F.R. Part 316
- State foreclosure statutes: CA Civ. Code §§ 1695, 2945; FL Ch. 501.1377;
  MD PHIFA RP § 7-301 et seq.; IL 765 ILCS 940; MN § 325N.10; CO C.R.S.
  § 6-1-1101; NY RPL § 265-a
- DPPA: 18 U.S.C. § 2721; Maracich v. Spears (2013)
- GLBA: 15 U.S.C. § 6801
- FHA: 42 U.S.C. § 3601; Texas DHCA v. Inclusive Communities (2015); HUD
  2023/2024 algorithmic-targeting guidance
- Wholesaler licensing: 225 ILCS 454/5-32 (IL); 59 O.S. § 858-102 (OK);
  PA RELRA 2023 amendment; SC Code § 40-57-30
- CFAA: Van Buren v. United States (2021); hiQ v. LinkedIn (9th Cir. 2022)
- HUD-counselor referral: 1-800-569-4287 / hud.gov/findacounselor

---

*End of plan. Ready for review. Open the markdown in a viewer that
renders tables. Mark inline comments where you want changes, and we'll
finalize before implementation.*
