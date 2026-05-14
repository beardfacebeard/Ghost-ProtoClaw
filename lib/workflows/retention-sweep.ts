/**
 * Time-based retention sweep.
 *
 * The May audit flagged unbounded growth on Message, LogEvent,
 * ActivityEntry, TokenUsageLog, ActionRun, and AuditEvent. At modest
 * usage these become 10M+ row tables within a year, and the cost
 * aggregation + activity stream queries start timing out.
 *
 * This module deletes rows older than per-table caps. Called from the
 * scheduler tick; gated so it only runs once per hour (the sweep itself
 * is cheap once the createdAt index is in place, but there's no need to
 * scan 1+ times per minute).
 *
 * Retention windows are intentionally generous so legitimate debugging
 * paths still have history:
 *   - Message            : 365 days
 *   - LogEvent           : 180 days
 *   - ActivityEntry      : 180 days (delegation-executor already sweeps
 *                          to 30d in its own pass; this is a backstop)
 *   - TokenUsageLog      : 365 days (cost history)
 *   - ActionRun          : 365 days
 *   - AuditEvent         : 365 days (regulatory + customer-disputes)
 *
 * For longer regulatory needs (e.g. AuditEvent kept for 7 years) export
 * to S3 before deletion. Not implemented here — flagged for a follow-up
 * once an export sink is wired.
 */

import { db } from "@/lib/db";
import { getLogger } from "@/lib/observability/logger";

const log = getLogger("retention-sweep");

/** Once per hour is plenty — deletes scale with rows, not invocations. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let lastSweepAt = 0;

const RETENTION_DAYS: Record<string, number> = {
  Message: 365,
  LogEvent: 180,
  ActivityEntry: 180,
  TokenUsageLog: 365,
  ActionRun: 365,
  AuditEvent: 365
};

/**
 * Run the time-based retention sweep if at least SWEEP_INTERVAL_MS has
 * elapsed since the last successful run. Idempotent and best-effort — a
 * failure on one table doesn't stop the others.
 */
export async function runRetentionSweep(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  const cutoffFor = (days: number) =>
    new Date(now - days * 24 * 60 * 60 * 1000);

  const results: Record<string, number> = {};

  // Per-table sweeps in parallel — each is independent.
  await Promise.allSettled([
    (async () => {
      try {
        const r = await db.message.deleteMany({
          where: { createdAt: { lt: cutoffFor(RETENTION_DAYS.Message) } }
        });
        results.Message = r.count;
      } catch (err) {
        log.error("Message retention delete failed", { err });
      }
    })(),
    (async () => {
      try {
        const r = await db.logEvent.deleteMany({
          where: { createdAt: { lt: cutoffFor(RETENTION_DAYS.LogEvent) } }
        });
        results.LogEvent = r.count;
      } catch (err) {
        log.error("LogEvent retention delete failed", { err });
      }
    })(),
    (async () => {
      try {
        const r = await db.activityEntry.deleteMany({
          where: { createdAt: { lt: cutoffFor(RETENTION_DAYS.ActivityEntry) } }
        });
        results.ActivityEntry = r.count;
      } catch (err) {
        log.error("ActivityEntry retention delete failed", { err });
      }
    })(),
    (async () => {
      try {
        const r = await db.tokenUsageLog.deleteMany({
          where: { createdAt: { lt: cutoffFor(RETENTION_DAYS.TokenUsageLog) } }
        });
        results.TokenUsageLog = r.count;
      } catch (err) {
        log.error("TokenUsageLog retention delete failed", { err });
      }
    })(),
    (async () => {
      try {
        const r = await db.actionRun.deleteMany({
          where: { createdAt: { lt: cutoffFor(RETENTION_DAYS.ActionRun) } }
        });
        results.ActionRun = r.count;
      } catch (err) {
        log.error("ActionRun retention delete failed", { err });
      }
    })(),
    (async () => {
      try {
        const r = await db.auditEvent.deleteMany({
          where: { createdAt: { lt: cutoffFor(RETENTION_DAYS.AuditEvent) } }
        });
        results.AuditEvent = r.count;
      } catch (err) {
        log.error("AuditEvent retention delete failed", { err });
      }
    })()
  ]);

  const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0);
  if (totalDeleted > 0) {
    log.info("retention sweep ran", {
      ...results,
      totalDeleted
    });
  }
}
