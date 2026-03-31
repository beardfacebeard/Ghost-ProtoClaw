import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { listIssues, createIssue, getIssueStats } from "@/lib/repository/issues";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  businessId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  assigneeAgentId: z.string().nullable().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["open", "in_progress", "review", "done", "cancelled"]).optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  labels: z.array(z.string()).optional(),
  dueDate: z.string().datetime().nullable().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const searchParams = request.nextUrl.searchParams;
    const statsOnly = searchParams.get("stats") === "true";

    if (statsOnly) {
      const stats = await getIssueStats(
        session.organizationId,
        session.role === "admin" ? session.businessIds : undefined
      );
      return addSecurityHeaders(NextResponse.json({ stats }));
    }

    const result = await listIssues({
      organizationId: session.organizationId,
      businessIds: session.role === "admin" ? session.businessIds : undefined,
      businessId: searchParams.get("businessId") ?? undefined,
      projectId: searchParams.get("projectId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
      assigneeAgentId: searchParams.get("assigneeAgentId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!, 10)
        : undefined,
      offset: searchParams.get("offset")
        ? parseInt(searchParams.get("offset")!, 10)
        : undefined
    });

    return addSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const body = await request.json();
    const data = createSchema.parse(body);

    const issue = await createIssue({
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined
    });

    return addSecurityHeaders(NextResponse.json(issue, { status: 201 }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
