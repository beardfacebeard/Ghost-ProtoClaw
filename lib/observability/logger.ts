/**
 * Structured logger — JSON-line output for log aggregators.
 *
 * The May audit flagged "49 raw console.log/console.error" calls across
 * the codebase with no APM, no Sentry, no OpenTelemetry. We're starting
 * with the cheapest fix that closes the gap: a tiny structured logger
 * that emits one JSON object per line so Railway / Loki / Datadog can
 * parse it directly. No new dependency, no DSN required, drop-in
 * compatible with the existing console.* call signature.
 *
 * Each entry has:
 *   - ts:      ISO timestamp
 *   - level:   debug | info | warn | error
 *   - source:  the named slice that emitted it (e.g. "scheduler",
 *              "approval-gate", "agent-chat"). Lets you grep by subsystem.
 *   - msg:     human-readable message
 *   - fields:  arbitrary structured context (agentId, businessId, etc.)
 *   - err:     when an Error was passed, we capture message + stack
 *
 * When SENTRY_DSN is set, errors are also forwarded to Sentry via a
 * lazy-loaded @sentry/nextjs (if installed). The whole thing is no-op
 * without the env var — no install required to get the structured logs.
 *
 * Adoption strategy: call sites swap `console.error("[scheduler] ...", err)`
 * for `log.scheduler.error("...", { err })` over time. The console.* calls
 * still work fine; this just makes new code searchable.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function activeMinLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[activeMinLevel()];
}

// ── Sentry hook (no-op when not installed) ────────────────────────

type SentryShape = {
  captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
  captureMessage?: (msg: string, ctx?: Record<string, unknown>) => void;
};

let sentryLoaded: SentryShape | null | "missing" = null;
async function getSentry(): Promise<SentryShape | null> {
  if (sentryLoaded === "missing") return null;
  if (sentryLoaded) return sentryLoaded;
  if (!process.env.SENTRY_DSN) {
    sentryLoaded = "missing";
    return null;
  }
  try {
    // Force dynamic resolution so TypeScript and the bundler don't try
    // to verify the package when it isn't installed. Operators wire
    // Sentry in by `npm i @sentry/nextjs` + setting SENTRY_DSN; until
    // then this branch returns null cleanly.
    const moduleName = "@sentry/nextjs";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await (Function("m", "return import(m)") as (
      m: string
    ) => Promise<unknown>)(moduleName).catch(() => null);
    if (!mod) {
      sentryLoaded = "missing";
      return null;
    }
    sentryLoaded = mod as SentryShape;
    return sentryLoaded;
  } catch {
    sentryLoaded = "missing";
    return null;
  }
}

// ── Core emitter ──────────────────────────────────────────────────

type SerializedError = {
  message: string;
  name?: string;
  stack?: string;
};

function serializeError(value: unknown): SerializedError | undefined {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack
    };
  }
  if (value === undefined) return undefined;
  return { message: String(value) };
}

/**
 * Pull a possibly-Error value from the fields under common keys and turn
 * it into a SerializedError on the emitted entry. Leaves the rest of the
 * fields object alone.
 */
function extractError(
  fields: LogFields | undefined
): { rest: LogFields | undefined; err: SerializedError | undefined } {
  if (!fields) return { rest: fields, err: undefined };
  const candidates = ["err", "error", "cause"] as const;
  for (const key of candidates) {
    if (key in fields && fields[key] !== undefined) {
      const err = serializeError(fields[key]);
      const rest = { ...fields };
      delete rest[key];
      return { rest, err };
    }
  }
  return { rest: fields, err: undefined };
}

function emit(
  source: string,
  level: LogLevel,
  msg: string,
  fields?: LogFields
) {
  if (!shouldEmit(level)) return;

  const { rest, err } = extractError(fields);
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    source,
    msg
  };
  if (rest && Object.keys(rest).length > 0) entry.fields = rest;
  if (err) entry.err = err;

  // Always write to stdout/stderr so Railway captures it.
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }

  // Forward errors to Sentry when configured. Non-blocking — we don't
  // await this; if the import is slow the log line is already out.
  if (level === "error" && err) {
    void getSentry().then((s) => {
      if (!s) return;
      try {
        s.captureException(err.stack ? new Error(err.message) : err.message, {
          tags: { source },
          extra: rest
        });
      } catch {
        /* never throw from logging */
      }
    });
  }
}

// ── Public API ────────────────────────────────────────────────────

export type Logger = {
  debug: (msg: string, fields?: LogFields) => void;
  info: (msg: string, fields?: LogFields) => void;
  warn: (msg: string, fields?: LogFields) => void;
  error: (msg: string, fields?: LogFields) => void;
  child: (extraFields: LogFields) => Logger;
};

function build(source: string, baseFields: LogFields = {}): Logger {
  const merge = (fields?: LogFields) =>
    fields ? { ...baseFields, ...fields } : baseFields;
  return {
    debug: (m, f) => emit(source, "debug", m, merge(f)),
    info: (m, f) => emit(source, "info", m, merge(f)),
    warn: (m, f) => emit(source, "warn", m, merge(f)),
    error: (m, f) => emit(source, "error", m, merge(f)),
    child: (extra) => build(source, { ...baseFields, ...extra })
  };
}

/**
 * Get a logger bound to a named source. The source string is grep-friendly
 * — keep it short and consistent (lowercase kebab-case). Examples:
 *   getLogger("scheduler")
 *   getLogger("agent-chat")
 *   getLogger("approval-gate")
 */
export function getLogger(source: string): Logger {
  return build(source);
}
