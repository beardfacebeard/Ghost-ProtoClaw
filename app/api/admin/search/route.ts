import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session?.organizationId) {
      throw unauthorized();
    }

    const query = request.nextUrl.searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return addSecurityHeaders(NextResponse.json({ results: [] }));
    }

    const scopeFilter =
      session.role === "admin"
        ? { businessId: { in: session.businessIds } }
        : {};

    const [businesses, agents, workflows] = await Promise.all([
      db.business.findMany({
        where: {
          organizationId: session.organizationId,
          ...(session.role === "admin"
            ? { id: { in: session.businessIds } }
            : {}),
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { slug: { contains: query, mode: "insensitive" as const } }
          ]
        },
        select: { id: true, name: true, status: true },
        take: 5
      }),
      db.agent.findMany({
        where: {
          organizationId: session.organizationId,
          ...scopeFilter,
          OR: [
            { displayName: { contains: query, mode: "insensitive" as const } },
            { role: { contains: query, mode: "insensitive" as const } }
          ]
        },
        select: { id: true, displayName: true, role: true, type: true },
        take: 5
      }),
      db.workflow.findMany({
        where: {
          organizationId: session.organizationId,
          ...scopeFilter,
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } }
          ]
        },
        select: { id: true, name: true, trigger: true },
        take: 5
      })
    ]);

    const results = [
      ...businesses.map((b) => ({
        id: b.id,
        label: b.name,
        href: `/admin/businesses/${b.id}`,
        type: "business" as const,
        detail: b.status
      })),
      ...agents.map((a) => ({
        id: a.id,
        label: a.displayName,
        href: `/admin/agents/${a.id}`,
        type: "agent" as const,
        detail: `${a.type} - ${a.role}`
      })),
      ...workflows.map((w) => ({
        id: w.id,
        label: w.name,
        href: `/admin/workflows/${w.id}`,
        type: "workflow" as const,
        detail: w.trigger
      }))
    ];

    return addSecurityHeaders(NextResponse.json({ results }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
