import { NextResponse } from "next/server";

export function securityHeaders() {
  const isProd = process.env.NODE_ENV === "production";

  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store",
    // HSTS — tell browsers to always use HTTPS (1 year, include subdomains)
    ...(isProd
      ? {
          "Strict-Transport-Security":
            "max-age=31536000; includeSubDomains; preload",
        }
      : {}),
    // CSP — restrict what the browser can load
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://openrouter.ai https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
    // Prevent MIME sniffing
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=()",
  } satisfies Record<string, string>;
}

export function addSecurityHeaders(response: NextResponse) {
  const headers = securityHeaders();

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
