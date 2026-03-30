import { NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { generateCsrfPair, setCsrfCookie } from "@/lib/auth/csrf";

export const dynamic = "force-dynamic";

export async function GET() {
  const { token, cookie } = generateCsrfPair();
  const response = NextResponse.json({
    csrfToken: token
  });

  setCsrfCookie(response, cookie);

  return addSecurityHeaders(response);
}
