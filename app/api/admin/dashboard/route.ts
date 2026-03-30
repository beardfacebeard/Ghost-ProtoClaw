import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse } from "@/lib/errors";
import {
  getChecklistStatus,
  getDashboardStats,
  getRecentActivity,
  getSystemHealth
} from "@/lib/repository/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            error: "Unauthorized",
            code: "UNAUTHORIZED"
          },
          { status: 401 }
        )
      );
    }

    if (!session.organizationId) {
      return addSecurityHeaders(
        NextResponse.json({
          stats: {
            activeBusinesses: 0,
            totalAgents: 0,
            workflowsEnabled: 0,
            pendingApprovals: 0
          },
          recentActivity: [],
          checklistStatus: {
            hasBusinesses: false,
            hasAgents: false,
            hasWorkflows: false,
            hasIntegrations: false,
            hasModels: false
          },
          systemHealth: {
            database: "error",
            openclaw: "unconfigured"
          }
        })
      );
    }

    const [stats, recentActivity, checklistStatus, systemHealth] =
      await Promise.all([
        getDashboardStats(
          session.organizationId,
          session.role,
          session.businessIds
        ),
        getRecentActivity(
          session.organizationId,
          10,
          session.role,
          session.businessIds
        ),
        getChecklistStatus(
          session.organizationId,
          session.role,
          session.businessIds
        ),
        getSystemHealth()
      ]);

    return addSecurityHeaders(
      NextResponse.json({
        stats,
        recentActivity,
        checklistStatus,
        systemHealth
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
