import { performance } from "node:perf_hooks";

import { getEncryptionKey, getSessionSecret } from "@/lib/auth/config";
import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";
import {
  getGatewayUrl,
  healthCheck as openclawHealthCheck
} from "@/lib/openclaw/client";
import {
  expireStaleApprovals,
  getPendingCount
} from "@/lib/repository/approvals";

export type HealthCheckResult = {
  name: string;
  status: "ok" | "warning" | "error" | "unconfigured";
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
  checkedAt: Date;
};

export type SystemHealthReport = {
  overall: "healthy" | "degraded" | "critical";
  checkedAt: Date;
  checks: HealthCheckResult[];
};

type HealthScope = {
  businessIds?: string[];
};

function now() {
  return new Date();
}

function withCheckedAt(
  check: Omit<HealthCheckResult, "checkedAt">,
  checkedAt = now()
): HealthCheckResult {
  return {
    ...check,
    checkedAt
  };
}

export async function checkDatabase(): Promise<HealthCheckResult> {
  const checkedAt = now();
  const startedAt = performance.now();

  try {
    await db.$queryRaw`SELECT 1`;
    const latencyMs = Math.round(performance.now() - startedAt);

    return withCheckedAt(
      {
        name: "Database",
        status:
          latencyMs < 500 ? "ok" : latencyMs <= 2000 ? "warning" : "error",
        message:
          latencyMs < 500
            ? "Database responded normally."
            : latencyMs <= 2000
              ? "Database is responding more slowly than expected."
              : "Database latency is critically high.",
        latencyMs
      },
      checkedAt
    );
  } catch (error) {
    return withCheckedAt(
      {
        name: "Database",
        status: "error",
        message: "Database health check failed.",
        details: {
          error: error instanceof Error ? error.message : "Unknown database error"
        }
      },
      checkedAt
    );
  }
}

export async function checkOpenClaw(): Promise<HealthCheckResult> {
  const checkedAt = now();
  const openclawUrl = getGatewayUrl();

  if (!openclawUrl) {
    return withCheckedAt(
      {
        name: "OpenClaw Runtime",
        status: "unconfigured",
        message: "OpenClaw runtime is not configured.",
        details: {
          setupHint:
            "Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN to connect your runtime."
        }
      },
      checkedAt
    );
  }

  const result = await openclawHealthCheck(5_000);

  if (result.success) {
    return withCheckedAt(
      {
        name: "OpenClaw Runtime",
        status: "ok",
        message: "OpenClaw runtime is reachable.",
        latencyMs: result.latencyMs,
        details: {
          url: openclawUrl,
          ...(result.data ?? {})
        }
      },
      checkedAt
    );
  }

  return withCheckedAt(
    {
      name: "OpenClaw Runtime",
      status: "error",
      message: result.error ?? "OpenClaw runtime could not be reached.",
      latencyMs: result.latencyMs > 0 ? result.latencyMs : undefined,
      details: {
        url: openclawUrl,
        error: result.error
      }
    },
    checkedAt
  );
}

/**
 * Verify that critical cryptographic secrets are present and functional. We
 * do an encrypt+decrypt roundtrip of a sentinel value so a misconfigured or
 * truncated ENCRYPTION_KEY fails readiness instead of 500ing the first time
 * an integration secret is touched.
 */
export async function checkSecrets(): Promise<HealthCheckResult> {
  const checkedAt = now();

  // Session signing secret — required for issuing/verifying JWTs.
  try {
    const sessionSecret = getSessionSecret();
    if (sessionSecret.length < 32) {
      return withCheckedAt(
        {
          name: "Secrets",
          status: "error",
          message:
            "SESSION_SECRET is shorter than 32 characters. Generate a new one with `openssl rand -hex 32`."
        },
        checkedAt
      );
    }
  } catch (error) {
    return withCheckedAt(
      {
        name: "Secrets",
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "SESSION_SECRET is not configured."
      },
      checkedAt
    );
  }

  // Integration encryption key — must be present and perform a successful
  // AES-256-GCM roundtrip. A silent misconfiguration here turns into
  // undecryptable integration credentials at runtime.
  try {
    const encryptionKey = getEncryptionKey();
    const sentinel = "gpc-health-check";
    const encrypted = encryptSecret(sentinel, encryptionKey);
    const decrypted = decryptSecret(encrypted, encryptionKey);

    if (decrypted !== sentinel) {
      return withCheckedAt(
        {
          name: "Secrets",
          status: "error",
          message: "Encryption roundtrip produced an unexpected value."
        },
        checkedAt
      );
    }
  } catch (error) {
    return withCheckedAt(
      {
        name: "Secrets",
        status: "error",
        message:
          error instanceof Error
            ? `Encryption key is not usable: ${error.message}`
            : "Encryption key is not usable."
      },
      checkedAt
    );
  }

  return withCheckedAt(
    {
      name: "Secrets",
      status: "ok",
      message: "Session and encryption secrets are present and functional."
    },
    checkedAt
  );
}

export async function checkEmailProvider(): Promise<HealthCheckResult> {
  const checkedAt = now();
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return withCheckedAt(
      {
        name: "Email Provider",
        status: "unconfigured",
        message: "Resend is not configured.",
        details: {
          setupHint: "Set RESEND_API_KEY to enable email features."
        }
      },
      checkedAt
    );
  }

  const valid = /^re_[A-Za-z0-9_-]{8,}$/.test(apiKey);

  return withCheckedAt(
    {
      name: "Email Provider",
      status: valid ? "ok" : "error",
      message: valid
        ? "Resend API key looks valid."
        : "Resend API key format is invalid.",
      details: valid
        ? undefined
        : {
            setupHint: "Use a valid RESEND_API_KEY from your Resend dashboard."
          }
    },
    checkedAt
  );
}

export async function checkStorageProvider(): Promise<HealthCheckResult> {
  const checkedAt = now();
  const bucket = process.env.AWS_S3_BUCKET?.trim();

  if (!bucket) {
    return withCheckedAt(
      {
        name: "Storage Provider",
        status: "unconfigured",
        message: "S3 storage is not configured.",
        details: {
          setupHint:
            "Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION to enable storage."
        }
      },
      checkedAt
    );
  }

  const missing = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION"
  ].filter((key) => !process.env[key]?.trim());

  return withCheckedAt(
    {
      name: "Storage Provider",
      status: missing.length === 0 ? "ok" : "warning",
      message:
        missing.length === 0
          ? "S3 storage configuration is present."
          : "S3 storage is only partially configured.",
      details: {
        bucket,
        missingEnv: missing,
        ...(missing.length > 0
          ? {
              setupHint:
                "Fill in all AWS storage environment variables before using file storage."
            }
          : {})
      }
    },
    checkedAt
  );
}

export async function checkIntegrations(
  organizationId: string,
  scope: HealthScope = {}
): Promise<HealthCheckResult[]> {
  const integrations = await db.integration.findMany({
    where: {
      organizationId,
      status: {
        in: ["connected", "error"]
      },
      ...(scope.businessIds !== undefined
        ? {
            OR: [
              {
                scope: "organization"
              },
              {
                assignedBusinessIds: {
                  hasSome: scope.businessIds
                }
              }
            ]
          }
        : {})
    },
    orderBy: {
      name: "asc"
    }
  });

  return integrations.map((integration) =>
    withCheckedAt({
      name: `Integration: ${integration.name}`,
      status: integration.status === "connected" ? "ok" : "error",
      message:
        integration.status === "connected"
          ? `${integration.name} is connected.`
          : `${integration.name} reported a connection error.`,
      details: {
        key: integration.key,
        scope: integration.scope,
        assignedBusinessIds: integration.assignedBusinessIds
      }
    })
  );
}

export async function checkPendingApprovals(
  organizationId: string,
  scope: HealthScope = {}
): Promise<HealthCheckResult> {
  const checkedAt = now();
  const pendingCount = await getPendingCount(organizationId, scope.businessIds);

  return withCheckedAt(
    {
      name: "Pending Approvals",
      status: pendingCount === 0 ? "ok" : "warning",
      message:
        pendingCount === 0
          ? "No approvals are waiting on a human."
          : `${pendingCount} approval(s) need review.`,
      details: {
        pendingCount
      }
    },
    checkedAt
  );
}

export async function checkExpiredApprovals(): Promise<HealthCheckResult> {
  const checkedAt = now();
  const expiredCount = await expireStaleApprovals();

  return withCheckedAt(
    {
      name: "Expired Approvals",
      status: expiredCount > 0 ? "warning" : "ok",
      message:
        expiredCount > 0
          ? `${expiredCount} stale approval(s) were expired automatically.`
          : "No stale approvals needed to be expired.",
      details: {
        expiredCount
      }
    },
    checkedAt
  );
}

export function determineOverallStatus(
  checks: HealthCheckResult[]
): "healthy" | "degraded" | "critical" {
  if (checks.some((check) => check.status === "error")) {
    return "critical";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "degraded";
  }

  return "healthy";
}

export async function runFullHealthCheck(
  organizationId?: string,
  scope: HealthScope = {}
): Promise<SystemHealthReport> {
  const checkedAt = now();
  const [
    database,
    secrets,
    openclaw,
    emailProvider,
    storageProvider,
    orgChecks
  ] = await Promise.all([
    checkDatabase(),
    checkSecrets(),
    checkOpenClaw(),
    checkEmailProvider(),
    checkStorageProvider(),
    organizationId
      ? Promise.all([
          checkIntegrations(organizationId, scope),
          checkPendingApprovals(organizationId, scope),
          checkExpiredApprovals()
        ])
      : Promise.resolve([[], null, null] as const)
  ]);

  const [integrationChecks, pendingApprovals, expiredApprovals] = orgChecks;
  const checks = [
    database,
    secrets,
    openclaw,
    emailProvider,
    storageProvider,
    ...integrationChecks,
    ...(pendingApprovals ? [pendingApprovals] : []),
    ...(expiredApprovals ? [expiredApprovals] : [])
  ];

  return {
    overall: determineOverallStatus(checks),
    checkedAt,
    checks
  };
}
