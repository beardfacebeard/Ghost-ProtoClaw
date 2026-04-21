import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { MEMORY_TIERS } from "@/lib/brain/workspace";
import { MEMORY_TYPE_LABELS } from "@/lib/brain/memory";
import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import {
  deleteMemory,
  getAgentMemoryById,
  updateMemoryFields,
  updateMemoryTier
} from "@/lib/repository/memory";

/**
 * PATCH accepts either a tier-only update (legacy shape, still used by
 * the tier-dropdown UI) or a full-field edit (from the new Edit Memory
 * drawer). Any subset of content/importance/type/tier/expiresAt is
 * accepted.
 */
const tierOnlyBodySchema = z.object({
  tier: z.enum(Object.keys(MEMORY_TIERS) as [string, ...string[]])
});

const fullEditBodySchema = z
  .object({
    content: z.string().min(1).max(10000).optional(),
    importance: z.number().int().min(1).max(10).optional(),
    type: z
      .enum(Object.keys(MEMORY_TYPE_LABELS) as [string, ...string[]])
      .optional(),
    tier: z
      .enum(Object.keys(MEMORY_TIERS) as [string, ...string[]])
      .optional(),
    // null = clear expiresAt; ISO string = set
    expiresAt: z.string().datetime().nullable().optional()
  })
  .refine(
    (v) =>
      v.content !== undefined ||
      v.importance !== undefined ||
      v.type !== undefined ||
      v.tier !== undefined ||
      v.expiresAt !== undefined,
    { message: "Provide at least one field to update." }
  );

type RouteContext = {
  params: {
    id: string;
  };
};

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getAgentMemoryById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!existing) {
      throw notFound("Memory not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    const raw = await request.json();
    const audit = {
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    };

    // Prefer the tier-only shape when it's the ONLY key present (so the
    // legacy tier-dropdown callers keep working unchanged). Otherwise
    // accept the full-field edit shape.
    const keys = Object.keys(raw ?? {});
    if (keys.length === 1 && keys[0] === "tier") {
      const { tier } = tierOnlyBodySchema.parse(raw);
      const memory = await updateMemoryTier(
        params.id,
        session.organizationId,
        tier,
        audit
      );
      return addSecurityHeaders(NextResponse.json({ memory }));
    }

    const body = fullEditBodySchema.parse(raw);
    const memory = await updateMemoryFields(
      params.id,
      session.organizationId,
      {
        content: body.content,
        importance: body.importance,
        type: body.type,
        tier: body.tier,
        expiresAt:
          body.expiresAt === undefined
            ? undefined
            : body.expiresAt === null
              ? null
              : new Date(body.expiresAt)
      },
      audit
    );

    return addSecurityHeaders(NextResponse.json({ memory }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getVerifiedSession(request);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const existing = await getAgentMemoryById(
      params.id,
      session.organizationId,
      session.role === "admin" ? session.businessIds : undefined
    );

    if (!existing) {
      throw notFound("Memory not found.");
    }

    if (session.role === "admin") {
      requireBusinessAccess(session, existing.businessId);
    }

    await deleteMemory(params.id, session.organizationId, {
      actorUserId: session.userId,
      actorEmail: session.email,
      ipAddress: request.headers.get("x-forwarded-for")
    });

    return addSecurityHeaders(
      NextResponse.json({
        success: true
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
