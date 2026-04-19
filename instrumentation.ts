/**
 * Next.js instrumentation hook — runs once per server process on boot.
 *
 * Used to start the in-process workflow scheduler so scheduled workflows
 * and delegated tasks actually fire without a separate worker service.
 *
 * Guard: skip ONLY when NEXT_RUNTIME is explicitly "edge". The previous
 * guard required === "nodejs", but NEXT_RUNTIME can be undefined during
 * the instrumentation call on some Next 14.2 deployments — including
 * Railway's — which caused the scheduler to never start in production.
 * That's the root cause of the "45 pending delegations, none ever run"
 * bug the user hit.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  // Dynamic import so Edge/build-time passes don't pull in the scheduler.
  const { startWorkflowScheduler } = await import(
    "@/lib/workflows/scheduler"
  );
  startWorkflowScheduler();
  console.log("[instrumentation] workflow scheduler bootstrap complete");
}
