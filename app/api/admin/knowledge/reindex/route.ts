import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession, requireBusinessAccess } from "@/lib/auth/rbac";
import {
  buildEmbeddingInput,
  EMBEDDING_MODEL,
  embedText,
  resolveOpenAiKey
} from "@/lib/brain/embeddings";
import { db } from "@/lib/db";
import {
  apiErrorResponse,
  badRequest,
  notFound,
  unauthorized
} from "@/lib/errors";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  businessId: z.string().trim().min(1),
  mode: z.enum(["missing", "all"]).optional(),
  limit: z.number().int().min(1).max(200).optional()
});

/**
 * Batch-embed KB items for a business. Defaults to only items that
 * don't yet have an embedding (or whose content changed after their
 * last embedding). Pass `mode: "all"` to force re-embed everything
 * (e.g. after switching embedding models).
 *
 * Processes in sequence to stay under OpenAI rate limits for the
 * smallest-tier API key. Caller can call repeatedly until
 * missingCount === 0.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = bodySchema.parse(await request.json());

    const business = await db.business.findFirst({
      where: {
        id: body.businessId,
        organizationId: session.organizationId
      },
      select: { id: true, organizationId: true }
    });
    if (!business) throw notFound("Business not found.");
    if (session.role === "admin") {
      requireBusinessAccess(session, business.id);
    }

    const apiKey = await resolveOpenAiKey(business.organizationId);
    if (!apiKey) {
      throw badRequest(
        "OpenAI is not configured. Add it under /admin/integrations → OpenAI, or set OPENAI_API_KEY on Railway, then retry."
      );
    }

    const mode = body.mode ?? "missing";
    const limit = body.limit ?? 50;

    const where =
      mode === "missing"
        ? {
            businessId: business.id,
            OR: [
              { embeddingGeneratedAt: null },
              { embedding: { equals: [] } }
            ]
          }
        : { businessId: business.id };

    const candidates = await db.knowledgeItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        content: true
      }
    });

    let embedded = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];
    for (const item of candidates) {
      try {
        const result = await embedText({
          text: buildEmbeddingInput(item),
          organizationId: business.organizationId
        });
        if (!result.success) {
          failed += 1;
          errors.push({ id: item.id, error: result.error });
          continue;
        }
        await db.knowledgeItem.update({
          where: { id: item.id },
          data: {
            embedding: result.vector,
            embeddingModel: result.model,
            embeddingGeneratedAt: new Date()
          }
        });
        embedded += 1;
      } catch (err) {
        failed += 1;
        errors.push({
          id: item.id,
          error: err instanceof Error ? err.message : "unknown"
        });
      }
    }

    const remaining = await db.knowledgeItem.count({
      where: {
        businessId: business.id,
        OR: [
          { embeddingGeneratedAt: null },
          { embedding: { equals: [] } }
        ]
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        mode,
        embedded,
        failed,
        remaining,
        model: EMBEDDING_MODEL,
        errors: errors.slice(0, 5)
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
