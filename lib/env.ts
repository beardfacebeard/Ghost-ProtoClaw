import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const optionalEmail = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().email().optional()
);

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_OPENCLAW_CONTROL_URL: optionalUrl,
  NEXT_PUBLIC_RAILWAY_TEMPLATE_URL: optionalUrl,
  NEXT_PUBLIC_OPENCLAW_RAILWAY_TEMPLATE_URL: optionalUrl,
  MISSION_CONTROL_ADMIN_EMAIL: z.string().email(),
  MISSION_CONTROL_ADMIN_PASSWORD: z.string().min(8),
  MISSION_CONTROL_ADMIN_NAME: z.string().min(1),
  MISSION_CONTROL_SESSION_SECRET: z.string().min(32),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(14),
  MAGIC_LINK_SECRET: z.string().min(32),
  RESEND_API_KEY: z.string().min(1),
  // EMAIL_FROM and RESEND_FROM_EMAIL are both accepted. lib/auth/config.ts
  // falls back RESEND_FROM_EMAIL -> EMAIL_FROM -> default, so neither is
  // strictly required. We validate as emails when present.
  EMAIL_FROM: optionalEmail,
  RESEND_FROM_EMAIL: optionalString,
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  OPENCLAW_GATEWAY_URL: z.string().url(),
  OPENCLAW_GATEWAY_TOKEN: optionalString,
  OPENCLAW_GATEWAY_TOKEN_FILE: optionalString,
  OPENCLAW_WEBHOOK_SECRET: z.string().min(32),
  OPENCLAW_WORKSPACE_ROOT: z.string().min(1),
  MISSION_CONTROL_WORKSPACE_MIRROR_MODE: z.enum(["disk", "database"]),
  WORKSPACE_SYNC_MODE: optionalString,
  OPENCLAW_CLI_COMMAND: z.string().min(1),
  ANTHROPIC_API_KEY: optionalString,
  OPENROUTER_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  MISSION_CONTROL_PROMPT_ASSIST_MODEL: z.string().min(1),
  INTEGRATION_ENCRYPTION_KEY: z.string().min(32),
  TELEGRAM_BOT_TOKEN: optionalString,
  TELEGRAM_ALLOWED_CHAT_IDS: optionalString,
  TELEGRAM_APPROVALS_CHANNEL_ID: optionalString,
  GMAIL_CLIENT_ID: optionalString,
  GMAIL_CLIENT_SECRET: optionalString,
  GMAIL_REFRESH_TOKEN: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: optionalString,
  OPENROUTER_CLIENT_ID: optionalString,
  OPENROUTER_CLIENT_SECRET: optionalString,
  GHL_API_KEY: optionalString,
  GHL_LOCATION_ID: optionalString,
  SKOOL_API_KEY: optionalString,
  SKOOL_COMMUNITY_URL: optionalUrl,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SIGNING_SECRET: optionalString,
  EMERGENT_API_KEY: optionalString,
  EMERGENT_PROJECT_SLUG: optionalString,
  WEB_SEARCH_PROVIDER: optionalString,
  WEB_SEARCH_API_KEY: optionalString,
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_REGION: optionalString,
  AWS_S3_BUCKET: optionalString,
  NIXPACKS_NODE_VERSION: optionalString,
  MASTER_AGENT_ENABLED: z
    .preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.string().optional()
    )
    .pipe(z.enum(["true", "false"]).optional()),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const formatted = parsedEnv.error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "unknown";
      return `- ${key}: ${issue.message}`;
    })
    .join("\n");

  throw new Error(
    [
      "Ghost ProtoClaw environment validation failed.",
      "Review your .env values and required secrets:",
      formatted
    ].join("\n")
  );
}

export const env = parsedEnv.data;
