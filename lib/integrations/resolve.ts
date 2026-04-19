import { decryptSecret } from "@/lib/auth/crypto";
import { getEncryptionKey } from "@/lib/auth/config";
import { db } from "@/lib/db";

/**
 * Resolve credentials for a given integration key.
 *
 * Priority for each requested field:
 *   1. Integration row in the DB, scoped to the organization (user
 *      entered the key via /admin/integrations — preferred for
 *      one-click-deploy UX so users never have to touch Railway).
 *   2. Environment variable fallback (for advanced users / Railway
 *      template defaults / anyone not using the in-app UI).
 *
 * Returns the merged key→value map. Fields that couldn't be found in
 * either source are simply omitted from the returned object, so
 * callers can check for the presence of required keys after merging.
 *
 * `fieldMap` declares, per integration-field-key, the env var to fall
 * back to. Example for HeyGen:
 *   { api_key: "HEYGEN_API_KEY" }
 *
 * When `organizationId` is undefined we skip the DB step entirely
 * (e.g. during schema generation or tests).
 */
export async function resolveIntegrationCredentials(
  organizationId: string | undefined,
  integrationKey: string,
  fieldMap: Record<string, string>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  if (organizationId) {
    try {
      const integration = await db.integration.findUnique({
        where: {
          organizationId_key: { organizationId, key: integrationKey }
        },
        select: {
          config: true,
          encryptedSecrets: true
        }
      });
      if (integration) {
        const encryptionKey = getEncryptionKey();
        const encryptedSecrets =
          integration.encryptedSecrets &&
          typeof integration.encryptedSecrets === "object" &&
          !Array.isArray(integration.encryptedSecrets)
            ? (integration.encryptedSecrets as Record<string, string>)
            : {};
        const config =
          integration.config &&
          typeof integration.config === "object" &&
          !Array.isArray(integration.config)
            ? (integration.config as Record<string, string>)
            : {};
        for (const field of Object.keys(fieldMap)) {
          const encrypted = encryptedSecrets[field];
          if (typeof encrypted === "string" && encrypted.length > 0) {
            try {
              const decrypted = decryptSecret(encrypted, encryptionKey);
              const trimmed = decrypted.trim();
              if (trimmed.length > 0) {
                result[field] = trimmed;
                continue;
              }
            } catch (err) {
              console.error(
                `[integrations] failed to decrypt ${integrationKey}.${field}:`,
                err
              );
            }
          }
          const configValue = config[field];
          if (typeof configValue === "string" && configValue.trim().length > 0) {
            result[field] = configValue.trim();
          }
        }
      }
    } catch (err) {
      console.error(
        `[integrations] DB lookup failed for ${integrationKey}:`,
        err
      );
      // fall through to env vars
    }
  }

  for (const [field, envName] of Object.entries(fieldMap)) {
    if (result[field]) continue;
    const envValue = process.env[envName]?.trim();
    if (envValue && envValue.length > 0) {
      result[field] = envValue;
    }
  }

  return result;
}

/**
 * Shorthand: return true iff every required field resolved to a
 * non-empty value from either the DB or the env vars.
 */
export async function hasAllCredentials(
  organizationId: string | undefined,
  integrationKey: string,
  fieldMap: Record<string, string>,
  required: string[]
): Promise<boolean> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    integrationKey,
    fieldMap
  );
  return required.every(
    (field) => typeof creds[field] === "string" && creds[field].length > 0
  );
}
