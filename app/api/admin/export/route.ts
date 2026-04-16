import { NextRequest, NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getVerifiedSession } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getVerifiedSession(request);
    if (!session?.organizationId) throw unauthorized();

    const [businesses, agents, workflows, skills, goals, projects, issues] =
      await Promise.all([
        db.business.findMany({
          where: { organizationId: session.organizationId },
          include: {
            agents: {
              select: {
                id: true,
                displayName: true,
                role: true,
                emoji: true,
                primaryModel: true,
                fallbackModel: true,
                systemPrompt: true,
                status: true,
                parentAgentId: true
              }
            }
          }
        }),
        db.agent.findMany({
          where: { business: { organizationId: session.organizationId } },
          select: {
            id: true,
            businessId: true,
            displayName: true,
            role: true,
            emoji: true,
            primaryModel: true,
            fallbackModel: true,
            systemPrompt: true,
            status: true,
            parentAgentId: true,
            agentSkills: {
              select: { skillId: true, enabled: true }
            }
          }
        }),
        db.workflow.findMany({
          where: { business: { organizationId: session.organizationId } },
          select: {
            id: true,
            businessId: true,
            name: true,
            description: true,
            trigger: true,
            enabled: true
          }
        }),
        db.skill.findMany({
          where: {
            organizationId: session.organizationId,
            status: "active"
          },
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            instructions: true,
            config: true,
            isRequired: true
          }
        }),
        db.goal.findMany({
          where: {
            business: { organizationId: session.organizationId }
          },
          select: {
            id: true,
            businessId: true,
            parentGoalId: true,
            title: true,
            description: true,
            status: true,
            progress: true,
            targetDate: true
          }
        }),
        db.project.findMany({
          where: {
            business: { organizationId: session.organizationId }
          },
          select: {
            id: true,
            businessId: true,
            name: true,
            description: true,
            status: true,
            targetDate: true
          }
        }),
        db.issue.findMany({
          where: {
            business: { organizationId: session.organizationId }
          },
          select: {
            id: true,
            businessId: true,
            projectId: true,
            assigneeAgentId: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            labels: true,
            dueDate: true
          }
        })
      ]);

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      organization: {
        id: session.organizationId
      },
      businesses,
      agents,
      workflows,
      skills,
      goals,
      projects,
      issues
    };

    return addSecurityHeaders(
      new NextResponse(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="ghost-protoclaw-export-${new Date().toISOString().slice(0, 10)}.json"`
        }
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
