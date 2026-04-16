import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
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
    const session = await getVerifiedSession(request);

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

export async function PATCH(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);

    if (!session) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: "Unauthorized", code: "UNAUTHORIZED" },
          { status: 401 }
        )
      );
    }

    if (!session.organizationId) {
      return addSecurityHeaders(
        NextResponse.json(
          { error: "No organization", code: "NO_ORGANIZATION" },
          { status: 400 }
        )
      );
    }

    const body = await request.json();

    if (body.action === "dismiss_checklist") {
      const org = await db.organization.findUnique({
        where: { id: session.organizationId },
        select: { config: true }
      });

      const existingConfig =
        org?.config && typeof org.config === "object" && !Array.isArray(org.config)
          ? (org.config as Record<string, unknown>)
          : {};

      await db.organization.update({
        where: { id: session.organizationId },
        data: {
          config: {
            ...existingConfig,
            checklist_dismissed: true
          }
        }
      });

      return addSecurityHeaders(
        NextResponse.json({ success: true })
      );
    }

    return addSecurityHeaders(
      NextResponse.json(
        { error: "Unknown action", code: "UNKNOWN_ACTION" },
        { status: 400 }
      )
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
