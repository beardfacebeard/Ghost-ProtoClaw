/**
 * Next.js instrumentation hook — runs once per server process on boot.
 *
 * Used to start the in-process workflow scheduler so scheduled workflows
 * actually fire without a separate worker service. Only runs on the Node.js
 * server runtime; Edge runtimes skip it (no setInterval, no direct DB).
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dynamic import so Edge/build-time passes don't pull in the scheduler.
  const { startWorkflowScheduler } = await import(
    "@/lib/workflows/scheduler"
  );
  startWorkflowScheduler();
}
