import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 direct-upload helpers.
 *
 * R2 is S3-compatible, so we reuse @aws-sdk/client-s3 (already a dep)
 * with the account-scoped endpoint. All keys live in env vars on
 * Railway — no per-business Integration rows for v1 to keep setup
 * friction low. Upgrade path: move into the Integration table when
 * multi-tenant key isolation matters.
 *
 * Required env (all must be set for uploads to work):
 *   R2_ACCOUNT_ID        — Cloudflare account id (from dashboard)
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET            — bucket name
 *
 * Optional:
 *   R2_PUBLIC_BASE_URL   — public URL prefix (custom domain or
 *                          pub-XXXX.r2.dev) served by Cloudflare. If
 *                          not set, presigned GET URLs are returned
 *                          from uploads instead of a stable public URL.
 */

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
};

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.trim() || undefined
  };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
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
  key: string;
  contentType: string;
  expiresSeconds?: number;
}): Promise<string> {
  const config = getR2Config();
  if (!config) {
    throw new Error(
      "R2 is not configured. Set R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET on Railway."
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
 * Resolve a stable public URL for a key. If R2_PUBLIC_BASE_URL is set
 * (custom domain or pub-*.r2.dev), we return that. Otherwise we fall
 * back to a presigned GET URL (valid for 7 days max per AWS SDK limit;
 * we use 24 hours).
 */
export async function resolvePublicUrl(key: string): Promise<string> {
  const config = getR2Config();
  if (!config) {
    throw new Error("R2 is not configured.");
  }
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }
  // Fall back to a presigned GET that lasts a day. Caller can refresh
  // by calling resolvePublicUrl again later.
  const client = buildClient(config);
  const command = new HeadObjectCommand({
    Bucket: config.bucket,
    Key: key
  });
  return getSignedUrl(client, command, { expiresIn: 60 * 60 * 24 });
}
