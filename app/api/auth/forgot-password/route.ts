import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getClientIp } from "@/lib/api/client-ip";
import { addSecurityHeaders } from "@/lib/api/headers";
import { forgotPasswordRateLimiter } from "@/lib/api/rate-limit";
import { findAdminUserByEmail } from "@/lib/auth/admin-user";
import { createMagicLink } from "@/lib/auth/magic-link";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { apiErrorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export async function POST(request: NextRequest) {
  try {
    const { email } = forgotPasswordSchema.parse(await request.json());
    const normalizedEmail = email.toLowerCase();

    // Rate limit per client IP only. We deliberately do NOT add a per-email
    // bucket — doing so would let any attacker who knows a target email fill
    // that bucket and lock the victim out of password recovery (targeted
    // denial of service). Per-IP alone still blunts mass abuse.
    const ipKey = `forgot-password:ip:${getClientIp(request)}`;
    const ipLimit = forgotPasswordRateLimiter.check(ipKey);

    if (!ipLimit.allowed) {
      const response = NextResponse.json(
        {
          success: true,
          message: "If that email is registered, you'll receive a reset link."
        },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(ipLimit.retryAfter ?? 60));

      return addSecurityHeaders(response);
    }

    forgotPasswordRateLimiter.increment(ipKey);

    const user = await findAdminUserByEmail(normalizedEmail);

    if (user && user.status === "active") {
      const { link } = await createMagicLink({
        email: user.email,
        type: "reset",
        userId: user.id,
        expiresInMinutes: 30
      });

      await sendPasswordResetEmail(user.email, link);

      await db.logEvent.create({
        data: {
          message: "Password reset link requested.",
          action: "password_reset_requested",
          metadata: {
            userId: user.id,
            email: user.email
          }
        }
      });
    }

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        message: "If that email is registered, you'll receive a reset link."
      })
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
