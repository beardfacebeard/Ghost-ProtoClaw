import type { Prisma } from "@prisma/client";

import { getEncryptionKey } from "@/lib/auth/config";
import { decryptSecret } from "@/lib/auth/crypto";
import { db } from "@/lib/db";

import type { Provider } from "./provider-for-model";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeySource = "org_db" | "env" | "openrouter_fallback";

export type ResolvedKey = {
  apiKey: string;
  source: KeySource;
  provider: string;
};

type ResolveContext = {
  provider: Provider;
  organizationId: string;
};

// ---------------------------------------------------------------------------
// Environment variable map
// ---------------------------------------------------------------------------

const ENV_VAR_FOR_PROVIDER: Record<Provider, string> = {
  openrouter: "OPENROUTER_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
};

// ---------------------------------------------------------------------------
// In-memory cache (TTL 60 s)
// ---------------------------------------------------------------------------

type CacheEntry = {
  value: ResolvedKey | null;
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(provider: string, organizationId: string) {
  return `${provider}::${organizationId}`;
}

function getCached(key: string): ResolvedKey | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCached(key: string, value: ResolvedKey | null) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Clear cached keys. When called without arguments every entry is removed.
 * When called with an `organizationId` only entries for that org are evicted.
 */
export function clearKeyCache(organizationId?: string) {
  if (!organizationId) {
    cache.clear();
    return;
  }

  const suffix = `::${organizationId}`;
  const keysToDelete: string[] = [];

  cache.forEach((_value, key) => {
    if (key.endsWith(suffix)) {
      keysToDelete.push(key);
    }
  });

  for (const key of keysToDelete) {
    cache.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readStringRecord(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

/**
 * Attempt to fetch an `api_key` from the Integration table for a given
 * provider key and organization.
 */
async function resolveFromDb(
  provider: Provider,
  organizationId: string
): Promise<string | null> {
  const integration = await db.integration.findUnique({
    where: {
      organizationId_key: {
        organizationId,
        key: provider,
      },
    },
  });

  if (!integration || integration.status !== "connected") {
    return null;
  }

  const encryptedSecrets = readStringRecord(integration.encryptedSecrets);
  const encryptedApiKey = encryptedSecrets.api_key;

  if (!encryptedApiKey) {
    return null;
  }

  try {
    return decryptSecret(encryptedApiKey, getEncryptionKey());
  } catch {
    return null;
  }
}

/**
 * Attempt to read an API key from the corresponding environment variable.
 */
function resolveFromEnv(provider: Provider): string | null {
  const envVar = ENV_VAR_FOR_PROVIDER[provider];
  const value = process.env[envVar]?.trim();
  return value && value.length > 0 ? value : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve an API key for the given provider and organization.
 *
 * Resolution order:
 * 1. Organization database record (Integration table, `status: "connected"`)
 * 2. Environment variable
 * 3. OpenRouter fallback (DB then env) — only when the originally requested
 *    provider is **not** already OpenRouter
 *
 * Returns `null` when no key can be found through any path.
 */
export async function resolveApiKey(
  ctx: ResolveContext
): Promise<ResolvedKey | null> {
  const ck = cacheKey(ctx.provider, ctx.organizationId);
  const cached = getCached(ck);
  if (cached !== undefined) return cached;

  // 1. Organisation DB
  const dbKey = await resolveFromDb(ctx.provider, ctx.organizationId);
  if (dbKey) {
    const result: ResolvedKey = {
      apiKey: dbKey,
      source: "org_db",
      provider: ctx.provider,
    };
    setCached(ck, result);
    return result;
  }

  // 2. Environment variable
  const envKey = resolveFromEnv(ctx.provider);
  if (envKey) {
    const result: ResolvedKey = {
      apiKey: envKey,
      source: "env",
      provider: ctx.provider,
    };
    setCached(ck, result);
    return result;
  }

  // 3. OpenRouter fallback (skip when already looking for openrouter)
  if (ctx.provider !== "openrouter") {
    const fallbackDbKey = await resolveFromDb(
      "openrouter",
      ctx.organizationId
    );
    if (fallbackDbKey) {
      const result: ResolvedKey = {
        apiKey: fallbackDbKey,
        source: "openrouter_fallback",
        provider: "openrouter",
      };
      setCached(ck, result);
      return result;
    }

    const fallbackEnvKey = resolveFromEnv("openrouter");
    if (fallbackEnvKey) {
      const result: ResolvedKey = {
        apiKey: fallbackEnvKey,
        source: "openrouter_fallback",
        provider: "openrouter",
      };
      setCached(ck, result);
      return result;
    }
  }

  // No key found
  setCached(ck, null);
  return null;
}
