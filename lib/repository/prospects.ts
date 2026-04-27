import { Prisma, type Prospect, type ProspectStageEvent } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Canonical prospect lifecycle stages, ordered. The funnel-drop-off
 * dashboard widget uses this ordering to compute conversion rates between
 * adjacent stages (sourced→qualified, qualified→contacted, …). Terminal
 * states (accepted / dead / stalled) sit outside the funnel for
 * conversion-rate math but still count against per-stage volume.
 */
export const PROSPECT_FUNNEL_STAGES = [
  "sourced",
  "qualified",
  "contacted",
  "replied",
  "engaged",
  "link_sent",
  "form_started",
  "form_completed",
  "accepted"
] as const;

export type ProspectFunnelStage = (typeof PROSPECT_FUNNEL_STAGES)[number];

export const PROSPECT_TERMINAL_STAGES = ["accepted", "dead", "stalled"] as const;

const STAGE_TIMESTAMP_FIELD: Partial<Record<string, keyof Prospect>> = {
  qualified: "qualifiedAt",
  contacted: "contactedAt",
  replied: "repliedAt",
  engaged: "engagedAt",
  link_sent: "linkSentAt",
  form_started: "formStartedAt",
  form_completed: "formCompletedAt",
  accepted: "acceptedAt",
  dead: "deadAt",
  stalled: "stalledAt"
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// ── Source / discovery ─────────────────────────────────────────────

export type RecordSourceInput = {
  businessId: string;
  businessName: string;
  state?: string | null;
  metro?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  cuisine?: string | null;
  liquorClass?: string | null;
  seatsEstimate?: number | null;
  reviewCount?: number | null;
  multiUnitFlag?: boolean;
  metadata?: Record<string, unknown> | null;
};

/**
 * Hunter calls this when sourcing a new prospect. Dedupes against
 * (businessId, businessName, state) — if a prospect with the same name in
 * the same state already exists, returns the existing row without
 * mutating it (Hunter's job is to surface candidates, not overwrite
 * Qualifier's scoring).
 */
export async function recordProspectSource(
  input: RecordSourceInput
): Promise<{ prospect: Prospect; created: boolean }> {
  const existing = await db.prospect.findFirst({
    where: {
      businessId: input.businessId,
      businessName: input.businessName,
      state: input.state ?? null
    }
  });
  if (existing) {
    return { prospect: existing, created: false };
  }

  const prospect = await db.prospect.create({
    data: {
      businessId: input.businessId,
      businessName: input.businessName,
      state: input.state ?? null,
      metro: input.metro ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      sourceType: input.sourceType ?? null,
      sourceUrl: input.sourceUrl ?? null,
      cuisine: input.cuisine ?? null,
      liquorClass: input.liquorClass ?? null,
      seatsEstimate: input.seatsEstimate ?? null,
      reviewCount: input.reviewCount ?? null,
      multiUnitFlag: input.multiUnitFlag ?? false,
      stage: "sourced",
      metadata: input.metadata ? toJsonValue(input.metadata) : Prisma.DbNull
    }
  });

  await db.prospectStageEvent.create({
    data: {
      prospectId: prospect.id,
      businessId: input.businessId,
      fromStage: null,
      toStage: "sourced",
      reason: input.sourceType ? `sourced via ${input.sourceType}` : "sourced",
      metadata: input.metadata ? toJsonValue(input.metadata) : Prisma.DbNull
    }
  });

  return { prospect, created: true };
}

// ── Qualification ──────────────────────────────────────────────────

export type QualifyInput = {
  prospectId: string;
  tier: "A" | "B" | "C" | null;
  fitScore: number;
  estimatedRecoveryBand?: string | null;
  multiUnitFlag?: boolean;
  fitNotes?: Record<string, unknown> | null;
};

export async function recordProspectQualification(
  input: QualifyInput
): Promise<Prospect> {
  const prospect = await db.prospect.findUnique({
    where: { id: input.prospectId }
  });
  if (!prospect) {
    throw new Error(`Prospect ${input.prospectId} not found`);
  }

  const updated = await db.prospect.update({
    where: { id: input.prospectId },
    data: {
      tier: input.tier,
      fitScore: input.fitScore,
      estimatedRecoveryBand: input.estimatedRecoveryBand ?? null,
      multiUnitFlag: input.multiUnitFlag ?? prospect.multiUnitFlag,
      fitNotes: input.fitNotes ? toJsonValue(input.fitNotes) : Prisma.DbNull,
      stage: "qualified",
      qualifiedAt: new Date(),
      lastTransitionAt: new Date()
    }
  });

  await db.prospectStageEvent.create({
    data: {
      prospectId: prospect.id,
      businessId: prospect.businessId,
      fromStage: prospect.stage,
      toStage: "qualified",
      reason: `tier ${input.tier ?? "?"} score ${input.fitScore}`,
      metadata: input.fitNotes ? toJsonValue(input.fitNotes) : Prisma.DbNull
    }
  });

  return updated;
}

// ── Generic stage transition ───────────────────────────────────────

export type TransitionInput = {
  prospectId: string;
  toStage: string;
  reason?: string | null;
  channel?: string | null;
  buyerState?: string | null;
  engagementScore?: number | null;
  engagementTier?: string | null;
  fallingTrust?: boolean;
  utmCampaign?: string | null;
  utmContent?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Transition a prospect to a new stage, log the event, and stamp the
 * appropriate per-stage timestamp. Idempotent: if the prospect is
 * already at toStage, only updates the engagement / state fields and
 * lastTransitionAt without creating a duplicate stage event.
 */
export async function transitionProspect(
  input: TransitionInput
): Promise<Prospect> {
  const prospect = await db.prospect.findUnique({
    where: { id: input.prospectId }
  });
  if (!prospect) {
    throw new Error(`Prospect ${input.prospectId} not found`);
  }

  const tsField = STAGE_TIMESTAMP_FIELD[input.toStage];
  const now = new Date();

  // Append to contactedChannels if a channel was supplied and isn't
  // already in the list.
  let nextChannels = prospect.contactedChannels;
  if (input.channel) {
    const current = Array.isArray(prospect.contactedChannels)
      ? (prospect.contactedChannels as unknown[]).filter(
          (v): v is string => typeof v === "string"
        )
      : [];
    if (!current.includes(input.channel)) {
      nextChannels = [...current, input.channel];
    }
  }

  const data: Prisma.ProspectUpdateInput = {
    stage: input.toStage,
    stageReason: input.reason ?? null,
    lastTransitionAt: now,
    primaryChannel: prospect.primaryChannel ?? input.channel ?? null,
    contactedChannels: nextChannels
      ? toJsonValue(nextChannels)
      : Prisma.DbNull,
    ...(input.buyerState !== undefined ? { buyerState: input.buyerState } : {}),
    ...(input.engagementScore !== undefined
      ? { engagementScore: input.engagementScore }
      : {}),
    ...(input.engagementTier !== undefined
      ? { engagementTier: input.engagementTier }
      : {}),
    ...(input.fallingTrust !== undefined
      ? { fallingTrust: input.fallingTrust }
      : {}),
    ...(input.utmCampaign !== undefined
      ? { utmCampaign: input.utmCampaign }
      : {}),
    ...(input.utmContent !== undefined
      ? { utmContent: input.utmContent }
      : {})
  };

  if (tsField && (prospect as unknown as Record<string, unknown>)[tsField] == null) {
    (data as Record<string, unknown>)[tsField] = now;
  }

  const updated = await db.prospect.update({
    where: { id: prospect.id },
    data
  });

  if (prospect.stage !== input.toStage) {
    await db.prospectStageEvent.create({
      data: {
        prospectId: prospect.id,
        businessId: prospect.businessId,
        fromStage: prospect.stage,
        toStage: input.toStage,
        reason: input.reason ?? null,
        metadata: input.metadata ? toJsonValue({
          ...input.metadata,
          channel: input.channel,
          buyerState: input.buyerState,
          engagementScore: input.engagementScore,
          engagementTier: input.engagementTier
        }) : toJsonValue({
          channel: input.channel,
          buyerState: input.buyerState,
          engagementScore: input.engagementScore,
          engagementTier: input.engagementTier
        })
      }
    });
  }

  return updated;
}

// ── Lookup helpers (used by webhook routes for inbound matching) ────

/**
 * Best-effort match an inbound webhook event to an existing Prospect by
 * email or phone. Returns null if no match — webhook code should still log
 * the inbound to ActivityEntry; the Prospect transition is bonus visibility.
 */
export async function findProspectByContact(
  businessId: string,
  contact: { email?: string | null; phone?: string | null }
): Promise<Prospect | null> {
  if (!contact.email && !contact.phone) return null;
  const orFilters: Prisma.ProspectWhereInput[] = [];
  if (contact.email) orFilters.push({ email: contact.email.toLowerCase() });
  if (contact.phone) orFilters.push({ phone: contact.phone });
  if (orFilters.length === 0) return null;

  return db.prospect.findFirst({
    where: { businessId, OR: orFilters },
    orderBy: { lastTransitionAt: "desc" }
  });
}

// ── Funnel summary (used by dashboard + Data Analyst) ──────────────

export type FunnelSummary = {
  stageCounts: Record<string, number>;
  conversionRates: Array<{
    fromStage: ProspectFunnelStage;
    toStage: ProspectFunnelStage;
    fromCount: number;
    everReachedTo: number;
    conversionRate: number;
  }>;
  leakiestStage: {
    fromStage: ProspectFunnelStage;
    toStage: ProspectFunnelStage;
    conversionRate: number;
  } | null;
  windowDays: number;
};

/**
 * Compute funnel-stage counts + adjacent conversion rates for the dashboard
 * widget + Data Analyst's weekly attribution report. Looks at prospects
 * sourced within the time window and counts how many ever reached each
 * downstream stage (via ProspectStageEvent — the prospect's current stage
 * may be later, but we want stage-reached counts).
 */
export async function computeFunnelSummary(
  businessId: string,
  windowDays = 30
): Promise<FunnelSummary> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  // Prospects sourced in the window
  const prospects = await db.prospect.findMany({
    where: { businessId, sourcedAt: { gte: since } },
    select: { id: true }
  });
  const prospectIds = prospects.map((p) => p.id);

  // For each stage, count distinct prospects that ever reached it
  // (via any stage event with toStage = stage). Sourced is a special
  // case: count = total prospects in window.
  const stageCounts: Record<string, number> = {
    sourced: prospects.length
  };

  if (prospectIds.length > 0) {
    const events = await db.prospectStageEvent.findMany({
      where: {
        businessId,
        prospectId: { in: prospectIds },
        toStage: { in: PROSPECT_FUNNEL_STAGES.filter((s) => s !== "sourced") }
      },
      select: { prospectId: true, toStage: true },
      distinct: ["prospectId", "toStage"]
    });
    for (const stage of PROSPECT_FUNNEL_STAGES) {
      if (stage === "sourced") continue;
      stageCounts[stage] = events.filter((e) => e.toStage === stage).length;
    }
  } else {
    for (const stage of PROSPECT_FUNNEL_STAGES) {
      if (stage === "sourced") continue;
      stageCounts[stage] = 0;
    }
  }

  const conversionRates = PROSPECT_FUNNEL_STAGES.slice(0, -1).map(
    (fromStage, idx) => {
      const toStage = PROSPECT_FUNNEL_STAGES[idx + 1];
      const fromCount = stageCounts[fromStage] ?? 0;
      const everReachedTo = stageCounts[toStage] ?? 0;
      const conversionRate =
        fromCount === 0 ? 0 : Math.round((everReachedTo / fromCount) * 1000) / 10;
      return { fromStage, toStage, fromCount, everReachedTo, conversionRate };
    }
  );

  // Leakiest stage = lowest conversion rate where the from-stage has at
  // least 5 prospects (avoids "0% from 1 prospect" noise).
  const candidates = conversionRates.filter((r) => r.fromCount >= 5);
  const leakiest =
    candidates.length === 0
      ? null
      : candidates.reduce((min, r) =>
          r.conversionRate < min.conversionRate ? r : min
        );

  return {
    stageCounts,
    conversionRates,
    leakiestStage: leakiest
      ? {
          fromStage: leakiest.fromStage,
          toStage: leakiest.toStage,
          conversionRate: leakiest.conversionRate
        }
      : null,
    windowDays
  };
}

export type { Prospect, ProspectStageEvent };
