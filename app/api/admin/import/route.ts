import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, badRequest, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const importSchema = z.object({
  version: z.string(),
  skills: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
        category: z.string().optional(),
        instructions: z.string().nullable().optional(),
        config: z.record(z.unknown()).nullable().optional(),
        isRequired: z.boolean().optional()
      })
    )
    .optional(),
  goals: z
    .array(
      z.object({
        businessId: z.string(),
        title: z.string(),
        description: z.string().nullable().optional(),
        status: z.string().optional(),
        progress: z.number().optional(),
        targetDate: z.string().nullable().optional()
      })
    )
    .optional()
});

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const body = await request.json();
    const data = importSchema.parse(body);

    const results = { skills: 0, goals: 0 };

    if (data.skills?.length) {
      for (const skill of data.skills) {
        try {
          await db.skill.upsert({
            where: {
              organizationId_name: {
                organizationId: session.organizationId,
                name: skill.name
              }
            },
            create: {
              organizationId: session.organizationId,
              name: skill.name,
              description: skill.description ?? null,
              category: skill.category ?? "general",
              instructions: skill.instructions ?? null,
              config: (skill.config as Prisma.InputJsonValue) ?? undefined,
              isRequired: skill.isRequired ?? false
            },
            update: {
              description: skill.description ?? null,
              category: skill.category ?? "general",
              instructions: skill.instructions ?? null,
              config: (skill.config as Prisma.InputJsonValue) ?? undefined,
              isRequired: skill.isRequired ?? false
            }
          });
          results.skills++;
        } catch {
          // skip individual failures
        }
      }
    }

    if (data.goals?.length) {
      // Verify business ownership
      const orgBusinesses = await db.business.findMany({
        where: { organizationId: session.organizationId },
        select: { id: true }
      });
      const validIds = new Set(orgBusinesses.map((b) => b.id));

      for (const goal of data.goals) {
        if (!validIds.has(goal.businessId)) continue;
        try {
          await db.goal.create({
            data: {
              businessId: goal.businessId,
              title: goal.title,
              description: goal.description ?? null,
              status: goal.status ?? "active",
              progress: goal.progress ?? 0,
              targetDate: goal.targetDate ? new Date(goal.targetDate) : null
            }
          });
          results.goals++;
        } catch {
          // skip individual failures
        }
      }
    }

    if (results.skills === 0 && results.goals === 0 && (data.skills?.length || data.goals?.length)) {
      throw badRequest("No items could be imported.");
    }

    return addSecurityHeaders(
      NextResponse.json({
        message: "Import complete.",
        imported: results
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
