import type { BuyerProfile, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Dealhawk Empire — buyer-list helpers.
 *
 * Wraps the BuyerProfile model with Dealhawk-specific querying:
 *   - listActiveBuyers(businessId)
 *   - matchBuyersForDeal(businessId, deal) — sorts by zip × buy-box ×
 *     deal-volume to produce the A-list for a disposition blast.
 *   - createBuyer / updateBuyer / archiveBuyer
 *
 * The Buyer List Builder agent (Agent 12) drives this; the Disposition
 * Agent (Agent 13) reads from it.
 */

export type BuyBox = "flip" | "brrrr" | "section_8" | "high_end" | "any";
export type FinancingType =
  | "cash"
  | "hard_money"
  | "dscr"
  | "private"
  | "any";
export type RehabLevel = "light" | "medium" | "heavy" | "any";
export type ContactMethod = "email" | "phone" | "sms" | "other";

export type NewBuyerInput = {
  name: string;
  llc?: string | null;
  contactMethod?: ContactMethod;
  email?: string | null;
  phone?: string | null;
  buyBox?: BuyBox;
  zipPreferences?: string[];
  minPurchasePrice?: number | null;
  maxPurchasePrice?: number | null;
  preferredRehabLevel?: RehabLevel;
  financingType?: FinancingType;
  notes?: string | null;
};

export type UpdateBuyerInput = Partial<NewBuyerInput> & {
  status?: "active" | "archived";
  lastDealDate?: Date | null;
  dealsLast12Mo?: number;
};

function normalizeZips(zips: string[] | undefined): Prisma.InputJsonValue {
  if (!zips || zips.length === 0) return [];
  return Array.from(
    new Set(
      zips
        .map((z) => z.trim())
        .filter((z) => /^\d{5}(-\d{4})?$/.test(z))
    )
  );
}

export async function listActiveBuyers(
  businessId: string
): Promise<BuyerProfile[]> {
  return db.buyerProfile.findMany({
    where: { businessId, status: "active" },
    orderBy: [
      { dealsLast12Mo: "desc" },
      { lastDealDate: "desc" },
      { name: "asc" },
    ],
  });
}

/**
 * Match buyers for a Deal — produces the ordered A-list for a
 * disposition blast. Match logic:
 *   1. Buyer's zipPreferences contains the deal's zip OR is empty
 *      (treat empty as "buys anywhere in the operator's market").
 *   2. Buy-box compatible with the deal's recommendedExit:
 *        wholesale-source     → flip / any
 *        BRRRR-source         → brrrr / section_8 / any
 *        flip-source          → flip / any
 *        sub_to / creative    → flip / brrrr / any (creative deals
 *                                often resell to flippers post-rehab
 *                                or get held by BRRRR landlords).
 *   3. Price band overlap (deal's purchasePrice or arvMid against
 *      buyer's min/maxPurchasePrice).
 *   4. Rehab tolerance: if the deal's heaviest rehab scenario is
 *      "heavy" and the buyer's preferredRehabLevel is "light", drop.
 *
 * Sorted by dealsLast12Mo desc — most active buyers first.
 */
export async function matchBuyersForDeal(
  businessId: string,
  deal: {
    propertyZip: string;
    arvMid: number | null;
    purchasePrice: number | null;
    rehabHeavy: number | null;
    recommendedExit: string | null;
  }
): Promise<{ buyers: BuyerProfile[]; reasons: string[] }> {
  const all = await listActiveBuyers(businessId);
  const reasons: string[] = [];

  const dealPrice = deal.purchasePrice ?? deal.arvMid ?? null;

  const compatibleBuyBoxes = (() => {
    switch (deal.recommendedExit) {
      case "wholesale":
      case "flip":
        return new Set(["flip", "any"]);
      case "brrrr":
        return new Set(["brrrr", "section_8", "any"]);
      case "sub_to":
      case "novation":
      case "wrap":
      case "lease_option":
      case "contract_for_deed":
        return new Set(["flip", "brrrr", "any"]);
      default:
        return new Set(["flip", "brrrr", "section_8", "high_end", "any"]);
    }
  })();

  const filtered = all.filter((b) => {
    // Zip match
    const zips = Array.isArray(b.zipPreferences)
      ? (b.zipPreferences as string[])
      : [];
    if (zips.length > 0 && !zips.includes(deal.propertyZip)) return false;
    // Buy-box compat
    if (!compatibleBuyBoxes.has(b.buyBox)) return false;
    // Price band
    if (dealPrice !== null) {
      if (b.minPurchasePrice !== null && dealPrice < b.minPurchasePrice)
        return false;
      if (b.maxPurchasePrice !== null && dealPrice > b.maxPurchasePrice)
        return false;
    }
    // Rehab tolerance
    if (
      b.preferredRehabLevel === "light" &&
      typeof deal.rehabHeavy === "number" &&
      deal.rehabHeavy > 30000
    ) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0 && all.length > 0) {
    reasons.push(
      `${all.length} active buyers in roster, but none matched the deal's zip ${deal.propertyZip}, buy-box (${deal.recommendedExit ?? "unspecified"}), price band, or rehab tolerance. Consider broadening buyer zip preferences or adjusting the recommended exit.`
    );
  } else if (all.length === 0) {
    reasons.push(
      "Buyer roster is empty. Add cash buyers via dealhawk_add_buyer (or import from past closings) before running disposition blasts."
    );
  }

  return { buyers: filtered, reasons };
}

export async function createBuyer(args: {
  businessId: string;
  organizationId: string;
  data: NewBuyerInput;
}): Promise<BuyerProfile> {
  return db.buyerProfile.create({
    data: {
      organizationId: args.organizationId,
      businessId: args.businessId,
      name: args.data.name.trim(),
      llc: args.data.llc?.trim() || null,
      contactMethod: args.data.contactMethod ?? "email",
      email: args.data.email?.trim().toLowerCase() || null,
      phone: args.data.phone?.trim() || null,
      buyBox: args.data.buyBox ?? "any",
      zipPreferences: normalizeZips(args.data.zipPreferences),
      minPurchasePrice: args.data.minPurchasePrice ?? null,
      maxPurchasePrice: args.data.maxPurchasePrice ?? null,
      preferredRehabLevel: args.data.preferredRehabLevel ?? "any",
      financingType: args.data.financingType ?? "cash",
      notes: args.data.notes?.trim() || null,
    },
  });
}

export async function updateBuyer(args: {
  buyerId: string;
  businessId: string;
  data: UpdateBuyerInput;
}): Promise<BuyerProfile> {
  const existing = await db.buyerProfile.findFirst({
    where: { id: args.buyerId, businessId: args.businessId },
  });
  if (!existing) {
    throw new Error("Buyer profile not found for this business.");
  }
  const updates: Parameters<typeof db.buyerProfile.update>[0]["data"] = {};
  if (args.data.name !== undefined) updates.name = args.data.name.trim();
  if (args.data.llc !== undefined) updates.llc = args.data.llc?.trim() || null;
  if (args.data.contactMethod !== undefined)
    updates.contactMethod = args.data.contactMethod;
  if (args.data.email !== undefined)
    updates.email = args.data.email?.trim().toLowerCase() || null;
  if (args.data.phone !== undefined)
    updates.phone = args.data.phone?.trim() || null;
  if (args.data.buyBox !== undefined) updates.buyBox = args.data.buyBox;
  if (args.data.zipPreferences !== undefined)
    updates.zipPreferences = normalizeZips(args.data.zipPreferences);
  if (args.data.minPurchasePrice !== undefined)
    updates.minPurchasePrice = args.data.minPurchasePrice;
  if (args.data.maxPurchasePrice !== undefined)
    updates.maxPurchasePrice = args.data.maxPurchasePrice;
  if (args.data.preferredRehabLevel !== undefined)
    updates.preferredRehabLevel = args.data.preferredRehabLevel;
  if (args.data.financingType !== undefined)
    updates.financingType = args.data.financingType;
  if (args.data.notes !== undefined)
    updates.notes = args.data.notes?.trim() || null;
  if (args.data.status !== undefined) updates.status = args.data.status;
  if (args.data.lastDealDate !== undefined)
    updates.lastDealDate = args.data.lastDealDate;
  if (args.data.dealsLast12Mo !== undefined)
    updates.dealsLast12Mo = args.data.dealsLast12Mo;
  return db.buyerProfile.update({
    where: { id: args.buyerId },
    data: updates,
  });
}

export async function archiveBuyer(args: {
  buyerId: string;
  businessId: string;
}): Promise<BuyerProfile> {
  const existing = await db.buyerProfile.findFirst({
    where: { id: args.buyerId, businessId: args.businessId },
  });
  if (!existing) {
    throw new Error("Buyer profile not found for this business.");
  }
  return db.buyerProfile.update({
    where: { id: args.buyerId },
    data: { status: "archived" },
  });
}
