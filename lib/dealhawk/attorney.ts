import type { AttorneyProfile } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Dealhawk Empire — attorney-on-file helpers.
 *
 * An AttorneyProfile is a licensed real-estate attorney on file for a
 * specific state. Required to upgrade dealMode to "contract" for any deal
 * whose property is in that state. Application-enforced "one active per
 * (businessId, state)" invariant — the DB schema does not enforce this
 * directly (see the schema comment on AttorneyProfile).
 */

export type NewAttorneyInput = {
  state: string;
  name: string;
  firmName?: string | null;
  email: string;
  phone?: string | null;
  barNumber?: string | null;
  notes?: string | null;
};

export type UpdateAttorneyInput = Partial<NewAttorneyInput> & {
  isActive?: boolean;
  licenseVerifiedAt?: Date | null;
};

function normalizeState(state: string): string {
  return state.trim().toUpperCase();
}

/**
 * List every AttorneyProfile for a business. By default, only active
 * profiles — pass includeArchived=true to get the full history.
 */
export async function listAttorneys(
  businessId: string,
  options: { includeArchived?: boolean } = {}
): Promise<AttorneyProfile[]> {
  return db.attorneyProfile.findMany({
    where: {
      businessId,
      ...(options.includeArchived ? {} : { isActive: true }),
    },
    orderBy: [{ state: "asc" }, { createdAt: "desc" }],
  });
}

/**
 * Get the single active AttorneyProfile for (businessId, state) or null.
 * This is the function the contract-generation gate (decideContractAction)
 * relies on.
 */
export async function getActiveAttorneyForState(
  businessId: string,
  state: string
): Promise<AttorneyProfile | null> {
  return db.attorneyProfile.findFirst({
    where: {
      businessId,
      state: normalizeState(state),
      isActive: true,
    },
  });
}

/**
 * Create a new AttorneyProfile for a business + state. If an active profile
 * already exists for that state, it is archived (isActive=false) in the
 * same transaction — the "one active per (businessId, state)" invariant.
 */
export async function createAttorney(args: {
  businessId: string;
  organizationId: string;
  data: NewAttorneyInput;
}): Promise<AttorneyProfile> {
  const state = normalizeState(args.data.state);
  if (!/^[A-Z]{2}$/.test(state)) {
    throw new Error(
      `State must be a 2-letter USPS code (e.g., "TX", "FL"). Received: "${args.data.state}".`
    );
  }
  return db.$transaction(async (tx) => {
    await tx.attorneyProfile.updateMany({
      where: {
        businessId: args.businessId,
        state,
        isActive: true,
      },
      data: { isActive: false },
    });
    return tx.attorneyProfile.create({
      data: {
        businessId: args.businessId,
        organizationId: args.organizationId,
        state,
        name: args.data.name.trim(),
        firmName: args.data.firmName?.trim() || null,
        email: args.data.email.trim().toLowerCase(),
        phone: args.data.phone?.trim() || null,
        barNumber: args.data.barNumber?.trim() || null,
        notes: args.data.notes?.trim() || null,
        isActive: true,
      },
    });
  });
}

/**
 * Update an existing AttorneyProfile. If the caller flips isActive to
 * true for a state that already has a different active profile, the
 * existing active profile is archived in the same transaction.
 */
export async function updateAttorney(args: {
  attorneyId: string;
  businessId: string;
  data: UpdateAttorneyInput;
}): Promise<AttorneyProfile> {
  return db.$transaction(async (tx) => {
    const existing = await tx.attorneyProfile.findFirst({
      where: { id: args.attorneyId, businessId: args.businessId },
    });
    if (!existing) {
      throw new Error("Attorney profile not found for this business.");
    }
    const nextState = args.data.state
      ? normalizeState(args.data.state)
      : existing.state;
    if (!/^[A-Z]{2}$/.test(nextState)) {
      throw new Error(
        `State must be a 2-letter USPS code (e.g., "TX", "FL"). Received: "${args.data.state ?? nextState}".`
      );
    }
    // If activating this profile, archive any other active profile for
    // the same state.
    if (args.data.isActive === true) {
      await tx.attorneyProfile.updateMany({
        where: {
          businessId: args.businessId,
          state: nextState,
          isActive: true,
          NOT: { id: args.attorneyId },
        },
        data: { isActive: false },
      });
    }
    return tx.attorneyProfile.update({
      where: { id: args.attorneyId },
      data: {
        state: nextState,
        ...(args.data.name !== undefined
          ? { name: args.data.name.trim() }
          : {}),
        ...(args.data.firmName !== undefined
          ? { firmName: args.data.firmName?.trim() || null }
          : {}),
        ...(args.data.email !== undefined
          ? { email: args.data.email.trim().toLowerCase() }
          : {}),
        ...(args.data.phone !== undefined
          ? { phone: args.data.phone?.trim() || null }
          : {}),
        ...(args.data.barNumber !== undefined
          ? { barNumber: args.data.barNumber?.trim() || null }
          : {}),
        ...(args.data.notes !== undefined
          ? { notes: args.data.notes?.trim() || null }
          : {}),
        ...(args.data.isActive !== undefined
          ? { isActive: args.data.isActive }
          : {}),
        ...(args.data.licenseVerifiedAt !== undefined
          ? { licenseVerifiedAt: args.data.licenseVerifiedAt }
          : {}),
      },
    });
  });
}

/**
 * Archive an AttorneyProfile (soft-delete). Sets isActive=false; the row
 * is preserved for audit / history. Hard-deletes are intentionally NOT
 * exposed — the per-state disclosure and dealMode audit trails benefit
 * from retaining inactive profiles.
 */
export async function archiveAttorney(args: {
  attorneyId: string;
  businessId: string;
}): Promise<AttorneyProfile> {
  const existing = await db.attorneyProfile.findFirst({
    where: { id: args.attorneyId, businessId: args.businessId },
  });
  if (!existing) {
    throw new Error("Attorney profile not found for this business.");
  }
  return db.attorneyProfile.update({
    where: { id: args.attorneyId },
    data: { isActive: false },
  });
}

/**
 * Return the distinct set of states (2-letter codes) that have an active
 * AttorneyProfile on file for this business. Used by the dealMode panel
 * to show coverage at a glance.
 */
export async function getCoveredStates(
  businessId: string
): Promise<string[]> {
  const active = await db.attorneyProfile.findMany({
    where: { businessId, isActive: true },
    select: { state: true },
    orderBy: { state: "asc" },
  });
  return Array.from(new Set(active.map((a) => a.state))).sort();
}
