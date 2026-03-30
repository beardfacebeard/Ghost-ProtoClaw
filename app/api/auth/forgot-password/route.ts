import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const { email } = forgotPasswordSchema.parse(await request.json());
    const normalizedEmail = email.toLowerCase();
    const ipKey = `forgot-password:ip:${clientIp(request)}`;
    const emailKey = `forgot-password:email:${normalizedEmail}`;
    const ipLimit = forgotPasswordRateLimiter.check(ipKey);
    const emailLimit = forgotPasswordRateLimiter.check(emailKey);
    const retryAfter = Math.max(ipLimit.retryAfter ?? 0, emailLimit.retryAfter ?? 0);

    if (!ipLimit.allowed || !emailLimit.allowed) {
      const response = NextResponse.json(
        {
          success: true,
          message: "If that email is registered, you'll receive a reset link."
        },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(retryAfter || 60));

      return addSecurityHeaders(response);
    }

    forgotPasswordRateLimiter.increment(ipKey);
    forgotPasswordRateLimiter.increment(emailKey);

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
