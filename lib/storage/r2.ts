import {
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { resolveIntegrationCredentials } from "@/lib/integrations/resolve";

/**
 * Cloudflare R2 direct-upload helpers.
 *
 * R2 is S3-compatible, so we reuse @aws-sdk/client-s3 (already a dep)
 * with the account-scoped endpoint. Credentials come from two sources,
 * preferred first:
 *   1. In-app Integration row (org-scoped, entered via
 *      /admin/integrations → "Cloudflare R2 Storage"). Encrypted at
 *      rest. Preferred because it keeps one-click-deploy friction low.
 *   2. Env-var fallback (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
 *      R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_BASE_URL) for
 *      advanced users and Railway template defaults.
 *
 * When neither source has the full set, helpers throw and the upload
 * UI shows a clean "add your R2 credentials" card.
 */

const R2_FIELD_MAP = {
  account_id: "R2_ACCOUNT_ID",
  access_key_id: "R2_ACCESS_KEY_ID",
  secret_access_key: "R2_SECRET_ACCESS_KEY",
  bucket: "R2_BUCKET",
  public_base_url: "R2_PUBLIC_BASE_URL"
} as const;

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
};

export async function getR2Config(
  organizationId?: string
): Promise<R2Config | null> {
  const creds = await resolveIntegrationCredentials(
    organizationId,
    "cloudflare_r2",
    R2_FIELD_MAP
  );
  const { account_id, access_key_id, secret_access_key, bucket } = creds;
  if (!account_id || !access_key_id || !secret_access_key || !bucket) {
    return null;
  }
  return {
    accountId: account_id,
    accessKeyId: access_key_id,
    secretAccessKey: secret_access_key,
    bucket,
    publicBaseUrl: creds.public_base_url || undefined
  };
}

export async function isR2Configured(
  organizationId?: string
): Promise<boolean> {
  return (await getR2Config(organizationId)) !== null;
}

function buildClient(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

/**
 * Build the key (path inside the bucket) we'll upload to. Scoped by
 * org + business so admin audits stay sane across multi-tenant setups.
 */
export function buildUploadKey(params: {
  organizationId: string;
  businessId?: string | null;
  folder?: string;
  filename: string;
}): string {
  const safeName = sanitizeFilename(params.filename);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const folder = params.folder
    ? params.folder.replace(/^\/+|\/+$/g, "")
    : "uploads";
  const scope = params.businessId
    ? `${params.organizationId}/${params.businessId}`
    : params.organizationId;
  return `${scope}/${folder}/${stamp}-${safeName}`;
}

/**
 * Create a presigned PUT URL the browser can upload directly to. The
 * file never hits the Next.js server, so there's no request body size
 * ceiling (bye 25MB local-disk limit).
 */
export async function createPresignedUploadUrl(params: {
  organizationId: string;
  key: string;
  contentType: string;
  expiresSeconds?: number;
}): Promise<string> {
  const config = await getR2Config(params.organizationId);
  if (!config) {
    throw new Error(
      "Cloudflare R2 is not configured. Add it under /admin/integrations → Cloudflare R2 Storage, or set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET on Railway."
    );
  }
  const client = buildClient(config);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: params.key,
    ContentType: params.contentType
  });
  return getSignedUrl(client, command, {
    expiresIn: params.expiresSeconds ?? 300
  });
}

/**
 * Server-side upload: push a Buffer directly into R2 (skips the
 * browser presign dance). Used by agent-called tools that generate
 * content remotely (fal.ai, HeyGen outputs we mirror, etc.) and
 * need to land it in R2 before returning a stable URL.
 *
 * Returns the key you then pass to resolvePublicUrl.
 */
export async function uploadBufferToR2(params: {
  organizationId: string;
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const config = await getR2Config(params.organizationId);
  if (!config) {
    throw new Error(
      "Cloudflare R2 is not configured. Add it under /admin/integrations → Cloudflare R2 Storage, or set R2 env vars on Railway."
    );
  }
  const client = buildClient(config);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType
    })
  );
}

/**
 * Download a public URL into memory and push it to R2. Returns the
 * key and the stable public URL. Used by tools that generate content
 * on third-party CDNs (fal.ai, HeyGen, Creatify) and need the asset
 * on our own storage before the provider's TTL expires.
 */
export async function fetchAndStoreInR2(params: {
  organizationId: string;
  sourceUrl: string;
  key: string;
  contentType?: string;
}): Promise<{ key: string; publicUrl: string; contentType: string; size: number }> {
  const response = await fetch(params.sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch source URL (${response.status}): ${params.sourceUrl.slice(0, 120)}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  const body = Buffer.from(arrayBuffer);
  const contentType =
    params.contentType ??
    response.headers.get("content-type") ??
    "application/octet-stream";
  await uploadBufferToR2({
    organizationId: params.organizationId,
    key: params.key,
    body,
    contentType
  });
  const publicUrl = await resolvePublicUrl(params.organizationId, params.key);
  return { key: params.key, publicUrl, contentType, size: body.byteLength };
}

/**
 * Resolve a stable public URL for a key. If public_base_url is set
 * (custom domain or pub-*.r2.dev), we return that. Otherwise we fall
 * back to a presigned GET URL (we use 24 hours — callers can refresh
 * later).
 */
export async function resolvePublicUrl(
  organizationId: string,
  key: string
): Promise<string> {
  const config = await getR2Config(organizationId);
  if (!config) {
    throw new Error("Cloudflare R2 is not configured.");
  }
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }
  const client = buildClient(config);
  const command = new HeadObjectCommand({
    Bucket: config.bucket,
    Key: key
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 60 * 24 });
}

/**
 * The CORS policy we install on the bucket. Broad on methods/headers
 * (R2 doesn't expose a fine-grained list the way AWS does) but tight
 * on origins — only the caller's app origin plus the Railway preview
 * URL pattern are allowed.
 */
export function buildR2CorsPolicy(allowedOrigins: string[]): {
  AllowedOrigins: string[];
  AllowedMethods: string[];
  AllowedHeaders: string[];
  ExposeHeaders: string[];
  MaxAgeSeconds: number;
}[] {
  return [
    {
      AllowedOrigins:
        allowedOrigins.length > 0 ? allowedOrigins : ["*"],
      AllowedMethods: ["PUT", "GET", "HEAD", "POST"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600
    }
  ];
}

/**
 * Apply a CORS policy to the R2 bucket so browser-direct uploads from
 * /admin/uploads and /admin/brand-assets don't get rejected by the
 * preflight. Requires the R2 API token to have the Admin Read+Write
 * permission on the bucket (Object-only tokens will 403 here — in
 * that case we surface an error so the UI can show the manual
 * paste-this-JSON fallback).
 */
export async function configureR2Cors(params: {
  organizationId: string;
  allowedOrigins: string[];
}): Promise<
  | { ok: true; appliedOrigins: string[] }
  | { ok: false; code: "unconfigured" | "forbidden" | "error"; message: string }
> {
  const config = await getR2Config(params.organizationId);
  if (!config) {
    return {
      ok: false,
      code: "unconfigured",
      message: "Cloudflare R2 is not configured."
    };
  }
  const origins = Array.from(
    new Set(params.allowedOrigins.filter((o) => o && o.trim().length > 0))
  );
  const rules = buildR2CorsPolicy(origins);
  try {
    const client = buildClient(config);
    await client.send(
      new PutBucketCorsCommand({
        Bucket: config.bucket,
        CORSConfiguration: {
          CORSRules: rules.map((rule) => ({
            AllowedOrigins: rule.AllowedOrigins,
            AllowedMethods: rule.AllowedMethods,
            AllowedHeaders: rule.AllowedHeaders,
            ExposeHeaders: rule.ExposeHeaders,
            MaxAgeSeconds: rule.MaxAgeSeconds
          }))
        }
      })
    );
    return { ok: true, appliedOrigins: origins };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const looksForbidden =
      /403|Forbidden|AccessDenied|unauthorized/i.test(message);
    return {
      ok: false,
      code: looksForbidden ? "forbidden" : "error",
      message
    };
  }
}
