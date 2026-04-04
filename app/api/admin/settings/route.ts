import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(1, "Display name is required.")
    .max(100, "Display name must be 100 characters or fewer.")
    .trim()
});

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session) {
      throw unauthorized();
    }

    const user = await db.missionControlAdminUser.findUnique({
      where: { id: session.userId },
      select: {
        displayName: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      throw unauthorized();
    }

    return addSecurityHeaders(
      NextResponse.json({
        ...user,
        organizationId: session.organizationId ?? null
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = getSessionFromHeaders(request.headers);

    if (!session) {
      throw unauthorized();
    }

    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    const updatedUser = await db.missionControlAdminUser.update({
      where: { id: session.userId },
      data: { displayName: data.displayName },
      select: {
        displayName: true,
        email: true,
        role: true
      }
    });

    return addSecurityHeaders(
      NextResponse.json({
        message: "Profile updated successfully.",
        user: updatedUser
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
