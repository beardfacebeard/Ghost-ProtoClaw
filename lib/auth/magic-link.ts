import { Prisma } from "@prisma/client";

import { getAppUrl } from "@/lib/auth/config";
import { generateSecureToken, hashToken } from "@/lib/auth/crypto";
import { db } from "@/lib/db";

type MagicLinkType = "login" | "invite" | "reset";

type CreateMagicLinkParams = {
  email: string;
  type: MagicLinkType;
  userId?: string;
  metadata?: Record<string, unknown>;
  expiresInMinutes?: number;
};

type VerifyMagicLinkResult = {
  valid: boolean;
  type?: string;
  email?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: string;
};

export async function createMagicLink({
  email,
  type,
  userId,
  metadata,
  expiresInMinutes = 30
}: CreateMagicLinkParams) {
  const token = generateSecureToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  await db.magicLink.create({
    data: {
      email: email.toLowerCase(),
      userId,
      tokenHash,
      type,
      metadata: metadata as Prisma.InputJsonValue | undefined,
      expiresAt
    }
  });

  const link = new URL("/auth/magic", getAppUrl());
  link.searchParams.set("token", token);
  link.searchParams.set("type", type);

  return {
    token,
    link: link.toString()
  };
}

export async function verifyMagicLink(
  token: string
): Promise<VerifyMagicLinkResult> {
  try {
    const tokenHash = hashToken(token);
    const magicLink = await db.magicLink.findUnique({
      where: { tokenHash }
    });

    if (!magicLink) {
      return { valid: false, error: "Magic link not found." };
    }

    if (magicLink.used) {
      return { valid: false, error: "Magic link has already been used." };
    }

    if (magicLink.expiresAt.getTime() <= Date.now()) {
      return { valid: false, error: "Magic link has expired." };
    }

    const updateResult = await db.magicLink.updateMany({
      where: {
        id: magicLink.id,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      },
      data: {
        used: true,
        usedAt: new Date()
      }
    });

    if (updateResult.count === 0) {
      return { valid: false, error: "Magic link has already been used." };
    }

    return {
      valid: true,
      type: magicLink.type,
      email: magicLink.email,
      userId: magicLink.userId ?? undefined,
      metadata:
        magicLink.metadata && typeof magicLink.metadata === "object"
          ? (magicLink.metadata as Record<string, unknown>)
          : undefined
    };
  } catch (error) {
    console.error("Magic link verification failed", error);
    return { valid: false, error: "Unable to verify magic link." };
  }
}

export async function cleanupExpiredMagicLinks() {
  const result = await db.magicLink.deleteMany({
    where: {
      OR: [
        {
          expiresAt: {
            lt: new Date()
          }
        },
        {
          used: true
        }
      ]
    }
  });

  return result.count;
}
