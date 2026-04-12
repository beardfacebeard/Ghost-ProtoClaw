import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addSecurityHeaders } from "@/lib/api/headers";
import { getSessionFromHeaders } from "@/lib/auth/rbac";
import { apiErrorResponse, notFound, unauthorized } from "@/lib/errors";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: { id: string } };

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["draft", "in_progress", "editing", "finalized"]).optional(),
  productId: z.string().nullable().optional(),
  brandId: z.string().nullable().optional(),
  inputAdUrl: z.string().nullable().optional(),
  inputAdNotes: z.string().max(5000).nullable().optional(),
  aiVersion1Url: z.string().nullable().optional(),
  aiVersion2Url: z.string().nullable().optional(),
  aiVersion3Url: z.string().nullable().optional(),
  aiVersion4Url: z.string().nullable().optional(),
  aiVersion5Url: z.string().nullable().optional(),
  chosenFavoriteUrl: z.string().nullable().optional(),
  editsRound1: z.string().max(5000).nullable().optional(),
  editedImage1Url: z.string().nullable().optional(),
  editsRound2: z.string().max(5000).nullable().optional(),
  editedImage2Url: z.string().nullable().optional(),
  finalImageUrl: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  resized916Url: z.string().nullable().optional(),
  resized11Url: z.string().nullable().optional(),
  resized43Url: z.string().nullable().optional(),
  metadata: z.any().optional(),
});

/** GET — Get a single ad-clone project with product and brand */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const project = await db.adCloneProject.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
      include: { product: true, brand: true },
    });
    if (!project) throw notFound("Project not found.");

    return addSecurityHeaders(NextResponse.json({ project }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** PATCH — Update an ad-clone project (main workflow endpoint) */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const existing = await db.adCloneProject.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });
    if (!existing) throw notFound("Project not found.");

    const body = await request.json();
    const data = updateSchema.parse(body);

    const project = await db.adCloneProject.update({
      where: { id: params.id },
      data,
      include: { product: true, brand: true },
    });

    return addSecurityHeaders(NextResponse.json({ project }));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/** DELETE — Delete an ad-clone project */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = getSessionFromHeaders(request.headers);
    if (!session?.organizationId) throw unauthorized();

    const existing = await db.adCloneProject.findFirst({
      where: { id: params.id, organizationId: session.organizationId },
    });
    if (!existing) throw notFound("Project not found.");

    await db.adCloneProject.delete({ where: { id: params.id } });

    return addSecurityHeaders(
      NextResponse.json({ message: "Project deleted." })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
