import type {
  PropertySearchProvider,
  ProviderHealth,
  ProviderSearchQuery,
  ProviderSearchResult,
  ProviderSignal,
  ProviderSkipTraceInput,
  ProviderSkipTraceResult,
} from "@/lib/dealhawk/providers/types";

/**
 * Dealhawk Empire — Demo property-search provider.
 *
 * Zero-dependency synthetic-data provider. Every Dealhawk business ships
 * with this enabled so the "Search providers" flow returns something
 * immediately, before the operator subscribes to BatchData / PropStream /
 * etc. Data is plausibly-realistic — real street names in real cities,
 * synthetic but structurally valid addresses — so operators can exercise
 * the scoring + import flow without any external account.
 *
 * The generator is deterministic per (city, state, zip, index) so the
 * same query returns the same results — operators don't get surprise
 * duplicates when they re-run a search, and dedup-by-providerRef works.
 * Small random variation in each run keeps the demo from feeling static.
 */

const STREET_NAMES = [
  "Oak Ridge Pl",
  "Pine Crest Dr",
  "Magnolia Ln",
  "Willow Creek Rd",
  "Sagebrush Way",
  "Cottonwood Ln",
  "Sage Canyon Ct",
  "Desert Rose Dr",
  "Cedar Hollow Way",
  "Juniper Ridge Dr",
  "Thunderbird Pl",
  "Tempe Butte Dr",
  "Val Vista Dr",
  "Mockingbird Ct",
  "Cascade Falls Rd",
  "Stone Mountain Cir",
  "Prestonwood Ct",
  "Ponce de Leon Ave",
  "Agua Fria Ln",
  "Saguaro Ridge Rd",
];

const HOUSE_NUMBERS = [
  123, 256, 389, 512, 645, 778, 901, 1024, 1157, 1290,
  1423, 1556, 1689, 1822, 1955, 2048, 2181, 2314, 2447, 2580,
];

const OWNER_NAMES_INDIVIDUAL = [
  "Marcus T. Holloway", "Angela R. Castillo", "Darnell K. Washington",
  "Juanita M. Alvarez", "Thomas & Rachel Chen", "Cynthia M. Powell",
  "Gerald A. Patterson", "Brian D. Ferguson", "Kevin R. Boone",
  "Raymond E. Dixon", "Robert & Linda Kim", "William & Susan Torres",
  "Denise A. Whitfield", "Marcus & Tanya Reid", "Priya N. Subramanian",
  "Lee J. Takahashi", "Stephanie A. Hinojosa", "Marcus Q. Bowers",
];

const LLC_NAMES = [
  "Oakwood Holdings LLC", "Sagebrush Investments LLC",
  "Glendale Properties LLC", "Desert Capital Holdings LLC",
  "Thunderbird Ventures LLC", "Cottonwood Asset Group LLC",
];

const ESTATE_NAMES = [
  "Estate of Patricia L. Reyes", "Estate of Harold W. Brennan",
  "Estate of Margaret E. Thompson", "Estate of Robert J. Mclemore",
];

/** Deterministic seeded pseudo-random number generator. Same seed → same
 *  sequence. Used to make each (city, state, index) produce stable
 *  results while still varying between different index positions. */
function seededRandom(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state << 5) - state + seed.charCodeAt(i);
    state |= 0;
  }
  return () => {
    // xorshift32
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10000) / 10000;
  };
}

function pickFrom<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Pool of signal-type archetypes with their base weights, sampled per
 * result so each synthetic property gets a plausible-looking distress
 * stack. The DemoProvider intentionally biases toward higher-motivation
 * results (so searches look impressive) but still returns a mix of
 * scores — operator should see that not every lead is gold.
 */
const SIGNAL_ARCHETYPES: Array<{
  types: Array<ProviderSignal["signalType"]>;
  equityPercent: number;
  tenureYears: number;
  /** Relative probability weight when sampling. */
  probability: number;
}> = [
  {
    types: ["pre_foreclosure", "absentee"],
    equityPercent: 62,
    tenureYears: 14,
    probability: 2,
  },
  {
    types: ["pre_foreclosure", "tax_delinquent"],
    equityPercent: 35,
    tenureYears: 9,
    probability: 3,
  },
  {
    types: ["probate", "vacancy"],
    equityPercent: 85,
    tenureYears: 22,
    probability: 2,
  },
  {
    types: ["tax_delinquent", "code_violation"],
    equityPercent: 72,
    tenureYears: 17,
    probability: 3,
  },
  {
    types: ["absentee", "eviction"],
    equityPercent: 48,
    tenureYears: 9,
    probability: 2,
  },
  {
    types: ["divorce"],
    equityPercent: 28,
    tenureYears: 6,
    probability: 2,
  },
  {
    types: ["expired_listing"],
    equityPercent: 22,
    tenureYears: 4,
    probability: 3,
  },
  {
    types: ["absentee"],
    equityPercent: 55,
    tenureYears: 11,
    probability: 4,
  },
];

function weightedSample<T extends { probability: number }>(
  rng: () => number,
  arr: T[]
): T {
  const total = arr.reduce((sum, x) => sum + x.probability, 0);
  let threshold = rng() * total;
  for (const item of arr) {
    threshold -= item.probability;
    if (threshold <= 0) return item;
  }
  return arr[arr.length - 1];
}

export class DemoProvider implements PropertySearchProvider {
  readonly key = "demo" as const;
  readonly label = "Demo (synthetic data)";

  isConfigured(): boolean {
    return true;
  }

  async health(): Promise<ProviderHealth> {
    return {
      provider: this.key,
      ok: true,
      latencyMs: 2,
      message:
        "Demo provider always available. Returns synthetic leads based on deterministic seeded data.",
    };
  }

  async search(
    query: ProviderSearchQuery
  ): Promise<ProviderSearchResult[]> {
    const state = query.state.trim().toUpperCase();
    const city = (query.city ?? "").trim();
    const cap = Math.min(Math.max(1, query.maxResults ?? 30), 60);

    // Seed makes (state, city) stable. A small time-component bucketed to
    // the day keeps runs fresh without causing minute-to-minute churn.
    const daySeed = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const rng = seededRandom(`${state}:${city}:${daySeed}`);

    const results: ProviderSearchResult[] = [];
    for (let i = 0; i < cap; i++) {
      const archetype = weightedSample(rng, SIGNAL_ARCHETYPES);

      // Filter out archetypes that don't match the operator's signal-type
      // filter (if any).
      if (
        query.signalTypes &&
        query.signalTypes.length > 0 &&
        !archetype.types.some((t) => query.signalTypes!.includes(t))
      ) {
        continue;
      }

      const houseNumber = pickFrom(rng, HOUSE_NUMBERS) + i * 7;
      const street = pickFrom(rng, STREET_NAMES);
      const zip =
        query.zips && query.zips.length > 0
          ? pickFrom(rng, query.zips)
          : `${Math.floor(rng() * 90000 + 10000)}`;

      const ownerBucket = rng();
      const ownerEntityType =
        ownerBucket < 0.7
          ? "individual"
          : ownerBucket < 0.85
            ? "llc"
            : "estate";
      const ownerName =
        ownerEntityType === "individual"
          ? pickFrom(rng, OWNER_NAMES_INDIVIDUAL)
          : ownerEntityType === "llc"
            ? pickFrom(rng, LLC_NAMES)
            : pickFrom(rng, ESTATE_NAMES);

      const arvEstimate = Math.round(150000 + rng() * 450000);
      const bedrooms = 2 + Math.floor(rng() * 4);
      const bathrooms = 1 + Math.floor(rng() * 3);
      const livingSqft = Math.round(900 + rng() * 2400);
      const yearBuilt = Math.round(1955 + rng() * 70);

      const signals: ProviderSignal[] = archetype.types.map((type) => ({
        signalType: type,
        sourceRef: `DEMO-${state}-${i}-${type.slice(0, 3).toUpperCase()}`,
        citedDate: new Date(
          Date.now() - Math.floor(rng() * 90 * 86400000)
        ).toISOString(),
        notes: `Synthetic demo signal for ${type} — seeded from (${state}, ${city}, day ${daySeed}).`,
      }));

      const providerRef = `DEMO-${state}-${city
        .replace(/\s+/g, "")
        .toUpperCase()
        .slice(0, 8) || "ANYCITY"}-${daySeed}-${i.toString().padStart(3, "0")}`;

      results.push({
        providerRef,
        propertyAddress: `${houseNumber} ${street}`,
        propertyCity: city || "Demo City",
        propertyState: state,
        propertyZip: String(zip),
        propertyType: "sfr",
        bedrooms,
        bathrooms,
        livingSqft,
        yearBuilt,
        ownerName,
        ownerEntityType,
        equityPercent: archetype.equityPercent,
        tenureYears: archetype.tenureYears,
        arvEstimate,
        signals,
      });
    }

    // Apply minMotivation filter — compute scores at the provider level so
    // the resolver doesn't need to know about scoring. This is fine
    // because the DemoProvider knows its own archetypes and wants to
    // honor the filter.
    const { computeMotivationScore } = await import(
      "@/lib/dealhawk/distress-score"
    );
    const scored = results.map((r) => {
      const { score } = computeMotivationScore({
        signals: r.signals.map((s) => ({ signalType: s.signalType })),
        equityPercent: r.equityPercent ?? undefined,
        tenureYears: r.tenureYears ?? undefined,
      });
      return { ...r, motivationScore: score };
    });
    const threshold = query.minMotivation ?? 0;
    return scored
      .filter((r) => (r.motivationScore ?? 0) >= threshold)
      .sort((a, b) => (b.motivationScore ?? 0) - (a.motivationScore ?? 0));
  }

  async skipTrace(
    input: ProviderSkipTraceInput
  ): Promise<ProviderSkipTraceResult> {
    // Deterministic demo skip-trace — returns one plausibly-formatted
    // phone + email so operators can exercise the flow. All phones are
    // 555-prefixed so nobody gets called in real life.
    const rng = seededRandom(
      `${input.ownerName}:${input.propertyAddress}:${input.propertyZip}`
    );
    const areaCode = 200 + Math.floor(rng() * 700);
    const exchange = 555;
    const line = 1000 + Math.floor(rng() * 9000);
    const firstName = (input.ownerName.split(" ")[0] ?? "owner").toLowerCase();
    return {
      phones: [
        {
          number: `+1${areaCode}${exchange}${line}`,
          type: "mobile",
          confidence: "demo",
        },
      ],
      emails: [
        {
          address: `${firstName}.${Math.floor(rng() * 999)}@example.com`,
          confidence: "demo",
        },
      ],
    };
  }
}
