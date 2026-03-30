const DEFAULT_SESSION_MAX_AGE_DAYS = 7;
const DEFAULT_RESEND_FROM_EMAIL = "Ghost ProtoClaw <noreply@ghostprotoclaw.com>";

function requireEnvValue(value: string | undefined, key: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.trim();
}

export function getAppUrl() {
  return requireEnvValue(process.env.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL");
}

export function getSessionSecret() {
  return requireEnvValue(
    process.env.SESSION_SECRET ?? process.env.MISSION_CONTROL_SESSION_SECRET,
    "SESSION_SECRET"
  );
}

export function getSessionMaxAgeDays() {
  const rawValue = process.env.SESSION_MAX_AGE_DAYS;
  if (!rawValue) {
    return DEFAULT_SESSION_MAX_AGE_DAYS;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SESSION_MAX_AGE_DAYS;
  }

  return parsed;
}

export function getEncryptionKey() {
  return requireEnvValue(
    process.env.ENCRYPTION_KEY ?? process.env.INTEGRATION_ENCRYPTION_KEY,
    "ENCRYPTION_KEY"
  );
}

export function getResendApiKey() {
  return requireEnvValue(process.env.RESEND_API_KEY, "RESEND_API_KEY");
}

export function getResendFromEmail() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    DEFAULT_RESEND_FROM_EMAIL
  );
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}
