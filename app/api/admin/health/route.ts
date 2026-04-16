import { NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import {
  checkDatabase,
  checkOpenClaw,
  checkSecrets
} from "@/lib/health/system-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const [databaseCheck, secretsCheck, openclawCheck] = await Promise.all([
    checkDatabase(),
    checkSecrets(),
    checkOpenClaw()
  ]);
  const databaseStatus = databaseCheck.status === "error" ? "error" : "ok";
  const secretsStatus = secretsCheck.status === "error" ? "error" : "ok";
  const openclawStatus =
    openclawCheck.status === "ok"
      ? "connected"
      : openclawCheck.status === "unconfigured"
        ? "unconfigured"
        : "error";

  // Critical checks fail readiness. OpenClaw being unreachable is degraded,
  // not critical — the admin UI still needs to come up so an operator can
  // fix the runtime configuration.
  const hasCriticalError =
    databaseStatus === "error" || secretsStatus === "error";

  const status = hasCriticalError
    ? "error"
    : openclawStatus === "connected"
      ? "ok"
      : "degraded";

  const response = NextResponse.json(
    {
      status,
      version: process.env.npm_package_version || "1.0.0",
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: databaseStatus,
          ...(databaseCheck.latencyMs
            ? { latencyMs: databaseCheck.latencyMs }
            : {})
        },
        secrets: {
          status: secretsStatus,
          ...(secretsStatus === "error"
            ? { message: secretsCheck.message }
            : {})
        },
        openclaw: {
          status: openclawStatus,
          ...(openclawCheck.status === "error"
            ? {
                hint:
                  "OpenClaw is configured but unreachable. Check that the runtime is running and the URL is correct."
              }
            : {})
        }
      }
    },
    {
      status: hasCriticalError ? 503 : 200
    }
  );

  return addSecurityHeaders(response);
}
