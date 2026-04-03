import { NextResponse } from "next/server";

import { addSecurityHeaders } from "@/lib/api/headers";
import { checkDatabase, checkOpenClaw } from "@/lib/health/system-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const [databaseCheck, openclawCheck] = await Promise.all([
    checkDatabase(),
    checkOpenClaw()
  ]);
  const databaseStatus = databaseCheck.status === "error" ? "error" : "ok";
  const openclawStatus =
    openclawCheck.status === "ok"
      ? "connected"
      : openclawCheck.status === "unconfigured"
        ? "unconfigured"
        : "error";

  const status =
    databaseStatus === "error"
      ? "error"
      : openclawStatus === "error"
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
      status: status === "error" ? 503 : 200
    }
  );

  return addSecurityHeaders(response);
}
