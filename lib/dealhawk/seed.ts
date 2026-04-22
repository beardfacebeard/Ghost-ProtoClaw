import type { Prisma } from "@prisma/client";

/**
 * Dealhawk Empire — demo seed data.
 *
 * Called from materializeTemplate in lib/templates/business-templates.ts
 * when a new business is created from the dealhawk_empire template. Seeds
 * 15 demo Deal rows across three Sun Belt metros (Dallas / Phoenix /
 * Atlanta) with stacked DealSignal records, so a first-login operator
 * sees the dashboard populated rather than an empty pipeline.
 *
 * The demo data covers:
 *   - Every pipeline stage (lead / contacted / qualified / under_contract
 *     / assigned / closed / dead).
 *   - Every recommended exit strategy (wholesale / BRRRR / flip / Sub-To /
 *     novation / decline).
 *   - The full range of motivation scores with realistic signal stacks.
 *   - Sub-To grand-slam examples (where wholesale MAO is negative but
 *     Sub-To penciled because of inherited sub-5% rate) so the Deal of
 *     the Day animation has a real subject.
 *   - Pre-foreclosure, probate, divorce, tax-delinquent, absentee,
 *     code-violation, and MLS-stale signal types.
 *
 * All addresses are synthetic — generic house numbers (123 / 456 / 789 /
 * 1024 / 2048) on real-named streets in real cities, so the data LOOKS
 * real for demo purposes but will never coincide with an actual parcel.
 * No demo AttorneyProfile is seeded — attorney-on-file must come from the
 * operator's own vetted legal counsel, not mock data.
 */

type SeedSignal = {
  signalType: string;
  sourceType: string;
  sourceRef?: string;
  citedDaysAgo: number;
  weight: number;
  confidence?: "high" | "medium" | "low";
  notes?: string;
};

type SeedDeal = {
  status: string;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyZip: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  livingSqft: number;
  yearBuilt: number;
  ownerName: string;
  ownerMailingAddress: string | null;
  ownerEntityType: string;
  arvLow: number;
  arvMid: number;
  arvHigh: number;
  rentEstimate: number;
  rehabLight: number;
  rehabMedium: number;
  rehabHeavy: number;
  maoWholesale: number;
  maoBrrrr: number;
  maoFlip: number;
  subToScore?: number;
  subToViability?: string;
  motivationScore: number;
  recommendedExit: string;
  source: string;
  sourceRef?: string;
  sellerResponseState?: string;
  firstContactDaysAgo?: number;
  nextTouchDaysFromNow?: number;
  contactAttempts?: number;
  contractType?: string;
  purchasePrice?: number;
  assignmentFee?: number;
  notes: string;
  signals: SeedSignal[];
};

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const DEMO_DEALS: SeedDeal[] = [
  // ── Dallas, TX (disclosure tier — TX requires contract-interest disclosure)
  {
    status: "lead",
    propertyAddress: "2048 Cottonwood Ln",
    propertyCity: "DeSoto",
    propertyState: "TX",
    propertyZip: "75115",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 2,
    livingSqft: 1820,
    yearBuilt: 1984,
    ownerName: "Marcus T. Holloway",
    ownerMailingAddress: "512 Willowcreek Rd, Oklahoma City, OK 73112",
    ownerEntityType: "individual",
    arvLow: 245000,
    arvMid: 262000,
    arvHigh: 278000,
    rentEstimate: 2100,
    rehabLight: 18000,
    rehabMedium: 32000,
    rehabHeavy: 58000,
    maoWholesale: 151400,
    maoBrrrr: 142000,
    maoFlip: 164500,
    subToScore: 82,
    subToViability: "grand_slam",
    motivationScore: 78,
    recommendedExit: "sub_to",
    source: "distress",
    notes:
      "Absentee out-of-state landlord, 14 yrs owned, 62% equity, inherited 3.125% rate from 2020 refi. PITI ~$1,340; market rent $2,100. Sub-To here is a grand-slam — wholesale MAO leaves almost no spread but Sub-To acquisition at $145K on a $262K asset with $760/mo positive cashflow is the winning exit.",
    signals: [
      {
        signalType: "pre_foreclosure",
        sourceType: "public_record",
        sourceRef: "DLC-2026-04-8812",
        citedDaysAgo: 34,
        weight: 40,
        confidence: "high",
        notes:
          "NOD filed 2026-03-19 in Dallas County. Approx 90 days into the 180-day window.",
      },
      {
        signalType: "absentee",
        sourceType: "batchdata",
        citedDaysAgo: 12,
        weight: 10,
        confidence: "high",
      },
      {
        signalType: "long_tenure",
        sourceType: "public_record",
        citedDaysAgo: 12,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 14-year tenure × 1.3.",
      },
      {
        signalType: "high_equity",
        sourceType: "batchdata",
        citedDaysAgo: 12,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 62% equity × 1.5.",
      },
    ],
  },
  {
    status: "contacted",
    propertyAddress: "789 Pinecrest Dr",
    propertyCity: "Garland",
    propertyState: "TX",
    propertyZip: "75040",
    propertyType: "sfr",
    bedrooms: 4,
    bathrooms: 2,
    livingSqft: 2140,
    yearBuilt: 1976,
    ownerName: "Estate of Patricia L. Reyes",
    ownerMailingAddress: null,
    ownerEntityType: "estate",
    arvLow: 268000,
    arvMid: 285000,
    arvHigh: 302000,
    rentEstimate: 2250,
    rehabLight: 22000,
    rehabMedium: 45000,
    rehabHeavy: 72000,
    maoWholesale: 154500,
    maoBrrrr: 90000,
    maoFlip: 168750,
    motivationScore: 65,
    recommendedExit: "wholesale",
    source: "distress",
    sellerResponseState: "wanted_time",
    firstContactDaysAgo: 9,
    nextTouchDaysFromNow: 14,
    contactAttempts: 2,
    notes:
      "Probate filed 2026-02 — two heirs, one in-state, one in California. First call went well; executor asked for 2 weeks to talk with the other heir. Follow-up scheduled. Deceased owned property free and clear — wholesale or cash offer most likely exit.",
    signals: [
      {
        signalType: "probate",
        sourceType: "public_record",
        sourceRef: "DLC-PR-2026-1194",
        citedDaysAgo: 58,
        weight: 30,
        confidence: "high",
      },
      {
        signalType: "vacancy",
        sourceType: "off_market_scrape",
        citedDaysAgo: 18,
        weight: 15,
        confidence: "medium",
        notes: "USPS long-term vacancy flag; utilities off per operator drive-by.",
      },
      {
        signalType: "long_tenure",
        sourceType: "public_record",
        citedDaysAgo: 58,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 22-year tenure × 1.3.",
      },
    ],
  },
  {
    status: "qualified",
    propertyAddress: "1024 Sagebrush Way",
    propertyCity: "Arlington",
    propertyState: "TX",
    propertyZip: "76017",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 2,
    livingSqft: 1580,
    yearBuilt: 1992,
    ownerName: "Darnell K. Washington",
    ownerMailingAddress: "4421 Harbor Point Dr, San Diego, CA 92103",
    ownerEntityType: "individual",
    arvLow: 215000,
    arvMid: 228000,
    arvHigh: 242000,
    rentEstimate: 1850,
    rehabLight: 12000,
    rehabMedium: 24000,
    rehabHeavy: 42000,
    maoWholesale: 135600,
    maoBrrrr: 87000,
    maoFlip: 147000,
    motivationScore: 52,
    recommendedExit: "wholesale",
    source: "absentee",
    sellerResponseState: "warm",
    firstContactDaysAgo: 22,
    nextTouchDaysFromNow: 3,
    contactAttempts: 4,
    notes:
      "Tired landlord, out-of-state (San Diego), 9 years owned. Current tenant 18 months behind on rent and refusing to leave. Seller opened to a 'handle-the-whole-mess' clean exit. Verbal agreement on $138K; paperwork pending.",
    signals: [
      {
        signalType: "absentee",
        sourceType: "batchdata",
        citedDaysAgo: 40,
        weight: 10,
        confidence: "high",
      },
      {
        signalType: "eviction",
        sourceType: "public_record",
        sourceRef: "TRCC-EV-2026-2241",
        citedDaysAgo: 11,
        weight: 20,
        confidence: "high",
        notes: "Eviction filed 2026-04-11. Tenant actively disputing.",
      },
    ],
  },
  {
    status: "lead",
    propertyAddress: "456 Mockingbird Ct",
    propertyCity: "Mesquite",
    propertyState: "TX",
    propertyZip: "75150",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 1,
    livingSqft: 1340,
    yearBuilt: 1968,
    ownerName: "Juanita M. Alvarez",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 178000,
    arvMid: 192000,
    arvHigh: 208000,
    rentEstimate: 1550,
    rehabLight: 28000,
    rehabMedium: 52000,
    rehabHeavy: 85000,
    maoWholesale: 82400,
    maoBrrrr: 41000,
    maoFlip: 92000,
    motivationScore: 71,
    recommendedExit: "brrrr",
    source: "distress",
    notes:
      "Tax delinquent 2 years (2024, 2025) + 3 active code violations (overgrown yard, broken fencing, gutter collapse). Rent-to-price ratio supports BRRRR if rehab stays at Medium scenario. Lead is aging — operator has not yet made first contact.",
    signals: [
      {
        signalType: "tax_delinquent",
        sourceType: "public_record",
        sourceRef: "DLC-TAX-2025-0918",
        citedDaysAgo: 102,
        weight: 25,
        confidence: "high",
        notes: "$4,820 owed across 2024–2025 tax years.",
      },
      {
        signalType: "code_violation",
        sourceType: "public_record",
        sourceRef: "MESQ-CODE-2026-0412",
        citedDaysAgo: 27,
        weight: 15,
        confidence: "high",
        notes: "3 active violations unresolved.",
      },
      {
        signalType: "long_tenure",
        sourceType: "public_record",
        citedDaysAgo: 102,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 17-year tenure × 1.3.",
      },
    ],
  },
  {
    status: "dead",
    propertyAddress: "123 Prestonwood Ct",
    propertyCity: "Plano",
    propertyState: "TX",
    propertyZip: "75093",
    propertyType: "sfr",
    bedrooms: 4,
    bathrooms: 3,
    livingSqft: 2680,
    yearBuilt: 1998,
    ownerName: "Robert & Linda Kim",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 485000,
    arvMid: 512000,
    arvHigh: 540000,
    rentEstimate: 3400,
    rehabLight: 15000,
    rehabMedium: 32000,
    rehabHeavy: 55000,
    maoWholesale: 326400,
    maoBrrrr: 172000,
    maoFlip: 352000,
    motivationScore: 42,
    recommendedExit: "decline",
    source: "mls_stale",
    sellerResponseState: "not_interested",
    firstContactDaysAgo: 41,
    contactAttempts: 3,
    notes:
      "Stale MLS listing, 145 DOM with 3 price drops ($529K → $505K → $485K asking). Seller refused to go below asking — $485K is already $40K above Wholesale MAO. Killed. Operator may revive in 90 days if listing stays stale.",
    signals: [
      {
        signalType: "expired_listing",
        sourceType: "mls",
        sourceRef: "NTREIS-20388291",
        citedDaysAgo: 3,
        weight: 10,
        confidence: "high",
        notes: "Listing just expired; seller relisting with new agent expected.",
      },
    ],
  },

  // ── Phoenix, AZ (permissive tier)
  {
    status: "contacted",
    propertyAddress: "789 Saguaro Ridge Rd",
    propertyCity: "Glendale",
    propertyState: "AZ",
    propertyZip: "85308",
    propertyType: "sfr",
    bedrooms: 4,
    bathrooms: 2.5,
    livingSqft: 2020,
    yearBuilt: 2008,
    ownerName: "Angela R. Castillo",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 368000,
    arvMid: 385000,
    arvHigh: 402000,
    rentEstimate: 2850,
    rehabLight: 8000,
    rehabMedium: 16000,
    rehabHeavy: 28000,
    maoWholesale: 253500,
    maoBrrrr: 155000,
    maoFlip: 272750,
    subToScore: 94,
    subToViability: "grand_slam",
    motivationScore: 89,
    recommendedExit: "sub_to",
    source: "distress",
    sellerResponseState: "warm",
    firstContactDaysAgo: 5,
    nextTouchDaysFromNow: 2,
    contactAttempts: 2,
    notes:
      "SUB-TO GRAND SLAM. Owner refinanced at 2.875% in mid-2021. Current balance $248K on a $385K asset. PITI $1,510/mo; market rent $2,850 → $1,340/mo positive cashflow. Seller relocating out-of-state for work and wants the mortgage off her name without taking a loss on the rate. Loan is conventional, no HELOC, no recent activity. Attorney consultation scheduled.",
    signals: [
      {
        signalType: "absentee",
        sourceType: "batchdata",
        citedDaysAgo: 18,
        weight: 10,
        confidence: "high",
        notes: "Seller recently listed mailing address in Colorado.",
      },
      {
        signalType: "high_equity",
        sourceType: "batchdata",
        citedDaysAgo: 18,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 36% equity × 1.5.",
      },
    ],
  },
  {
    status: "qualified",
    propertyAddress: "2048 Val Vista Dr",
    propertyCity: "Mesa",
    propertyState: "AZ",
    propertyZip: "85213",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 2,
    livingSqft: 1720,
    yearBuilt: 1995,
    ownerName: "Thomas & Rachel Chen",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 295000,
    arvMid: 312000,
    arvHigh: 330000,
    rentEstimate: 2300,
    rehabLight: 14000,
    rehabMedium: 28000,
    rehabHeavy: 48000,
    maoWholesale: 190400,
    maoBrrrr: 110000,
    maoFlip: 206000,
    motivationScore: 74,
    recommendedExit: "wholesale",
    source: "distress",
    sellerResponseState: "warm",
    firstContactDaysAgo: 15,
    nextTouchDaysFromNow: 1,
    contactAttempts: 5,
    notes:
      "Divorce filing 2026-02; court-ordered sale within 90 days of decree. Both parties signed off on pursuing a cash offer. Operator is the only buyer actively engaged. Offer of $195K under review; closing target 2026-05-15. Clean wholesale assignment expected — already have an A-list cash buyer lined up.",
    signals: [
      {
        signalType: "divorce",
        sourceType: "public_record",
        sourceRef: "MAR-DV-2026-0294",
        citedDaysAgo: 68,
        weight: 25,
        confidence: "high",
        notes: "Mutual-consent divorce with court-ordered property sale clause.",
      },
    ],
  },
  {
    status: "lead",
    propertyAddress: "1024 Agua Fria Ln",
    propertyCity: "Avondale",
    propertyState: "AZ",
    propertyZip: "85323",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 2,
    livingSqft: 1490,
    yearBuilt: 1989,
    ownerName: "Glendale Holdings LLC",
    ownerMailingAddress: "8834 E Thomas Rd, Scottsdale, AZ 85251",
    ownerEntityType: "llc",
    arvLow: 232000,
    arvMid: 248000,
    arvHigh: 264000,
    rentEstimate: 1950,
    rehabLight: 16000,
    rehabMedium: 30000,
    rehabHeavy: 52000,
    maoWholesale: 143600,
    maoBrrrr: 87000,
    maoFlip: 156000,
    motivationScore: 58,
    recommendedExit: "novation",
    source: "absentee",
    notes:
      "Absentee LLC-held, 14-year tenure, 60% equity. Principal of the LLC owns 4 other properties in West Phoenix. Novation + retail-exit strategy likely maximizes upside for both sides — owner doesn't need to cash out fast and the path-of-progress in this zip supports a 9-month appreciation play.",
    signals: [
      {
        signalType: "absentee",
        sourceType: "batchdata",
        citedDaysAgo: 8,
        weight: 10,
        confidence: "high",
      },
      {
        signalType: "long_tenure",
        sourceType: "public_record",
        citedDaysAgo: 8,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 14-year tenure × 1.3.",
      },
      {
        signalType: "high_equity",
        sourceType: "batchdata",
        citedDaysAgo: 8,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 60% equity × 1.5.",
      },
    ],
  },
  {
    status: "contacted",
    propertyAddress: "456 Thunderbird Pl",
    propertyCity: "Peoria",
    propertyState: "AZ",
    propertyZip: "85381",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 2,
    livingSqft: 1850,
    yearBuilt: 2003,
    ownerName: "William & Susan Torres",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 312000,
    arvMid: 332000,
    arvHigh: 352000,
    rentEstimate: 2450,
    rehabLight: 11000,
    rehabMedium: 22000,
    rehabHeavy: 38000,
    maoWholesale: 210400,
    maoBrrrr: 125000,
    maoFlip: 227000,
    subToScore: 78,
    subToViability: "good",
    motivationScore: 82,
    recommendedExit: "sub_to",
    source: "distress",
    sellerResponseState: "wanted_time",
    firstContactDaysAgo: 11,
    nextTouchDaysFromNow: 5,
    contactAttempts: 1,
    notes:
      "Stacked distress: NOD filed 45 days ago + tax delinquent 2024 + seller expressed credit-protection anxiety on first call. Rate is 3.625%, PITI $1,680 vs market rent $2,450. Gold-tier. Seller asked for 5 days to think about Sub-To vs short-sale. Follow-up with attorney intro ready.",
    signals: [
      {
        signalType: "pre_foreclosure",
        sourceType: "public_record",
        sourceRef: "MAR-NOD-2026-3188",
        citedDaysAgo: 45,
        weight: 40,
        confidence: "high",
      },
      {
        signalType: "tax_delinquent",
        sourceType: "public_record",
        sourceRef: "MAR-TAX-2025-4418",
        citedDaysAgo: 72,
        weight: 25,
        confidence: "high",
        notes: "$2,140 owed 2024 tax year.",
      },
    ],
  },
  {
    status: "under_contract",
    propertyAddress: "789 Tempe Butte Dr",
    propertyCity: "Tempe",
    propertyState: "AZ",
    propertyZip: "85281",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 2,
    livingSqft: 1650,
    yearBuilt: 1979,
    ownerName: "Brian D. Ferguson",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 342000,
    arvMid: 360000,
    arvHigh: 378000,
    rentEstimate: 2700,
    rehabLight: 18000,
    rehabMedium: 36000,
    rehabHeavy: 62000,
    maoWholesale: 216000,
    maoBrrrr: 126000,
    maoFlip: 234000,
    motivationScore: 68,
    recommendedExit: "wholesale",
    source: "distress",
    sellerResponseState: "closed",
    firstContactDaysAgo: 38,
    contactAttempts: 6,
    contractType: "assignment",
    purchasePrice: 215000,
    assignmentFee: 14500,
    notes:
      "UNDER CONTRACT. Wholesale assignment for $14,500. Cash buyer (flipper we've worked with before) has signed the assignment and placed $2K non-refundable deposit. Closing scheduled 2026-05-08. Title work in progress. Clean deal.",
    signals: [
      {
        signalType: "expired_listing",
        sourceType: "mls",
        sourceRef: "ARMLS-2093341",
        citedDaysAgo: 50,
        weight: 10,
        confidence: "high",
      },
      {
        signalType: "tax_delinquent",
        sourceType: "public_record",
        citedDaysAgo: 30,
        weight: 25,
        confidence: "high",
        notes: "$1,860 unpaid 2024 tax — curable at closing.",
      },
    ],
  },

  // ── Atlanta, GA (permissive tier)
  {
    status: "qualified",
    propertyAddress: "456 Magnolia Ridge Dr",
    propertyCity: "East Point",
    propertyState: "GA",
    propertyZip: "30344",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 2,
    livingSqft: 1420,
    yearBuilt: 1956,
    ownerName: "Gerald A. Patterson",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 172000,
    arvMid: 185000,
    arvHigh: 198000,
    rentEstimate: 1850,
    rehabLight: 22000,
    rehabMedium: 42000,
    rehabHeavy: 68000,
    maoWholesale: 87500,
    maoBrrrr: 69000,
    maoFlip: 96750,
    motivationScore: 68,
    recommendedExit: "brrrr",
    source: "distress",
    sellerResponseState: "warm",
    firstContactDaysAgo: 18,
    nextTouchDaysFromNow: 4,
    contactAttempts: 3,
    notes:
      "BRRRR candidate — rent-to-price ratio 1.08% (exceeds 1% threshold). Section-8 friendly zip. Seller is elderly (78), family is involved in the decision. Daughter asked for full paperwork review before next call — flagged for ethical review by Objection Handler; recommend seller's independent attorney consultation before any contract.",
    signals: [
      {
        signalType: "long_tenure",
        sourceType: "public_record",
        citedDaysAgo: 35,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 23-year tenure × 1.3.",
      },
      {
        signalType: "code_violation",
        sourceType: "public_record",
        sourceRef: "ATL-CODE-2026-0938",
        citedDaysAgo: 22,
        weight: 15,
        confidence: "high",
        notes: "2 active violations — roof and gutter.",
      },
      {
        signalType: "high_equity",
        sourceType: "batchdata",
        citedDaysAgo: 35,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 71% equity × 1.5.",
      },
    ],
  },
  {
    status: "lead",
    propertyAddress: "123 Stone Mountain Cir",
    propertyCity: "Stone Mountain",
    propertyState: "GA",
    propertyZip: "30083",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 1.5,
    livingSqft: 1380,
    yearBuilt: 1971,
    ownerName: "Oakwood Investments LLC",
    ownerMailingAddress: "1518 Market St, Philadelphia, PA 19102",
    ownerEntityType: "llc",
    arvLow: 158000,
    arvMid: 172000,
    arvHigh: 186000,
    rentEstimate: 1620,
    rehabLight: 14000,
    rehabMedium: 28000,
    rehabHeavy: 48000,
    maoWholesale: 92400,
    maoBrrrr: 69000,
    maoFlip: 101000,
    motivationScore: 54,
    recommendedExit: "wholesale",
    source: "absentee",
    notes:
      "Out-of-state LLC owner (Philadelphia). LLC has been inactive for 2 years per GA Secretary of State records. Likely dormant tired-landlord situation — property may have deferred maintenance. Tax records current.",
    signals: [
      {
        signalType: "absentee",
        sourceType: "batchdata",
        citedDaysAgo: 4,
        weight: 10,
        confidence: "high",
      },
      {
        signalType: "long_tenure",
        sourceType: "public_record",
        citedDaysAgo: 4,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 11-year LLC ownership × 1.3.",
      },
    ],
  },
  {
    status: "contacted",
    propertyAddress: "789 Ponce de Leon Ave",
    propertyCity: "Decatur",
    propertyState: "GA",
    propertyZip: "30030",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 2,
    livingSqft: 1860,
    yearBuilt: 1948,
    ownerName: "Cynthia M. Powell",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 398000,
    arvMid: 425000,
    arvHigh: 452000,
    rentEstimate: 2950,
    rehabLight: 28000,
    rehabMedium: 58000,
    rehabHeavy: 95000,
    maoWholesale: 239500,
    maoBrrrr: 119000,
    maoFlip: 260750,
    subToScore: 86,
    subToViability: "grand_slam",
    motivationScore: 75,
    recommendedExit: "sub_to",
    source: "distress",
    sellerResponseState: "warm",
    firstContactDaysAgo: 7,
    nextTouchDaysFromNow: 3,
    contactAttempts: 2,
    notes:
      "NOD filed 60 days ago. Owner's rate is 3.25% (2020 purchase). PITI $1,940 vs market rent $2,950. Sub-To would preserve her credit and avoid foreclosure on her record. Seller asked for an attorney consultation — operator is covering the attorney's fee ($350) as part of the deal prep.",
    signals: [
      {
        signalType: "pre_foreclosure",
        sourceType: "public_record",
        sourceRef: "DEK-NOD-2026-0612",
        citedDaysAgo: 60,
        weight: 40,
        confidence: "high",
      },
    ],
  },
  {
    status: "assigned",
    propertyAddress: "1024 Cedar Hollow Way",
    propertyCity: "Douglasville",
    propertyState: "GA",
    propertyZip: "30135",
    propertyType: "sfr",
    bedrooms: 4,
    bathrooms: 2,
    livingSqft: 1950,
    yearBuilt: 1989,
    ownerName: "Kevin R. Boone",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 242000,
    arvMid: 258000,
    arvHigh: 274000,
    rentEstimate: 2100,
    rehabLight: 18000,
    rehabMedium: 36000,
    rehabHeavy: 58000,
    maoWholesale: 144600,
    maoBrrrr: 90000,
    maoFlip: 157500,
    motivationScore: 64,
    recommendedExit: "wholesale",
    source: "distress",
    sellerResponseState: "closed",
    firstContactDaysAgo: 52,
    contactAttempts: 7,
    contractType: "assignment",
    purchasePrice: 142000,
    assignmentFee: 12000,
    notes:
      "ASSIGNED. Wholesale assignment closed 2026-04-11 for $12,000 fee. Cash buyer is an A-list flipper who has closed 4 deals with us. Funds received. Pipeline win — use as a reference point for new operator onboarding.",
    signals: [
      {
        signalType: "tax_delinquent",
        sourceType: "public_record",
        citedDaysAgo: 180,
        weight: 25,
        confidence: "high",
        notes: "$3,480 owed 2024 tax year — cured at closing.",
      },
      {
        signalType: "absentee",
        sourceType: "batchdata",
        citedDaysAgo: 95,
        weight: 10,
        confidence: "high",
      },
    ],
  },
  {
    status: "dead",
    propertyAddress: "2048 Cascade Falls Rd",
    propertyCity: "Atlanta",
    propertyState: "GA",
    propertyZip: "30311",
    propertyType: "sfr",
    bedrooms: 3,
    bathrooms: 1,
    livingSqft: 1280,
    yearBuilt: 1962,
    ownerName: "Raymond E. Dixon",
    ownerMailingAddress: null,
    ownerEntityType: "individual",
    arvLow: 142000,
    arvMid: 158000,
    arvHigh: 174000,
    rentEstimate: 1480,
    rehabLight: 35000,
    rehabMedium: 68000,
    rehabHeavy: 115000,
    maoWholesale: 42600,
    maoBrrrr: 20000,
    maoFlip: 52000,
    motivationScore: 49,
    recommendedExit: "decline",
    source: "distress",
    sellerResponseState: "not_interested",
    firstContactDaysAgo: 28,
    contactAttempts: 2,
    notes:
      "Stacked code violations (4 active) + hoarder-condition flag from drive-by photos. Repair Cost Estimator escalated to 'heavy+ requires in-person inspection' — blind estimate unreliable. Seller refused inspection. Declined. Revive in 6 months if seller's situation changes.",
    signals: [
      {
        signalType: "code_violation",
        sourceType: "public_record",
        sourceRef: "ATL-CODE-2026-0224",
        citedDaysAgo: 62,
        weight: 15,
        confidence: "high",
        notes: "4 active violations — structural, sanitation, exterior, debris.",
      },
      {
        signalType: "long_tenure",
        sourceType: "public_record",
        citedDaysAgo: 62,
        weight: 0,
        confidence: "high",
        notes: "Multiplier — 31-year tenure × 1.3.",
      },
    ],
  },
];

export async function seedDealhawkDemoData(
  tx: Prisma.TransactionClient,
  businessId: string,
  organizationId: string
): Promise<{ dealsCreated: number; signalsCreated: number }> {
  let dealsCreated = 0;
  let signalsCreated = 0;

  for (const seed of DEMO_DEALS) {
    const deal = await tx.deal.create({
      data: {
        organizationId,
        businessId,
        status: seed.status,
        propertyAddress: seed.propertyAddress,
        propertyCity: seed.propertyCity,
        propertyState: seed.propertyState,
        propertyZip: seed.propertyZip,
        propertyType: seed.propertyType,
        bedrooms: seed.bedrooms,
        bathrooms: seed.bathrooms,
        livingSqft: seed.livingSqft,
        yearBuilt: seed.yearBuilt,
        ownerName: seed.ownerName,
        ownerMailingAddress: seed.ownerMailingAddress,
        ownerEntityType: seed.ownerEntityType,
        arvLow: seed.arvLow,
        arvMid: seed.arvMid,
        arvHigh: seed.arvHigh,
        rentEstimate: seed.rentEstimate,
        rehabLight: seed.rehabLight,
        rehabMedium: seed.rehabMedium,
        rehabHeavy: seed.rehabHeavy,
        maoWholesale: seed.maoWholesale,
        maoBrrrr: seed.maoBrrrr,
        maoFlip: seed.maoFlip,
        subToScore: seed.subToScore ?? null,
        subToViability: seed.subToViability ?? null,
        motivationScore: seed.motivationScore,
        recommendedExit: seed.recommendedExit,
        source: seed.source,
        sourceRef: seed.sourceRef ?? null,
        firstContactAt:
          seed.firstContactDaysAgo !== undefined
            ? daysAgo(seed.firstContactDaysAgo)
            : null,
        lastContactAt:
          seed.firstContactDaysAgo !== undefined
            ? daysAgo(
                Math.max(0, seed.firstContactDaysAgo - (seed.contactAttempts ?? 0) * 2)
              )
            : null,
        nextTouchAt:
          seed.nextTouchDaysFromNow !== undefined
            ? daysFromNow(seed.nextTouchDaysFromNow)
            : null,
        contactAttempts: seed.contactAttempts ?? 0,
        sellerResponseState: seed.sellerResponseState ?? null,
        contractSignedAt:
          seed.contractType !== undefined ? daysAgo(11) : null,
        contractType: seed.contractType ?? null,
        purchasePrice: seed.purchasePrice ?? null,
        assignmentFee: seed.assignmentFee ?? null,
        notes: seed.notes,
        config: { demoSeed: true, seededAt: new Date().toISOString() },
      },
    });
    dealsCreated++;

    for (const signal of seed.signals) {
      await tx.dealSignal.create({
        data: {
          organizationId,
          dealId: deal.id,
          signalType: signal.signalType,
          sourceType: signal.sourceType,
          sourceRef: signal.sourceRef ?? null,
          citedDate: daysAgo(signal.citedDaysAgo),
          weight: signal.weight,
          confidence: signal.confidence ?? "medium",
          notes: signal.notes ?? null,
        },
      });
      signalsCreated++;
    }
  }

  return { dealsCreated, signalsCreated };
}
