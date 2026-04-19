/**
 * Next.js instrumentation hook — runs once per server process on boot.
 *
 * With experimental.instrumentationHook enabled, Next bundles this file
 * for EVERY runtime (nodejs + edge). If we reference the scheduler
 * directly here, webpack tries to bundle node:crypto / node:fs /
 * node:perf_hooks into the edge build and fails with UnhandledSchemeError.
 *
 * The two-file pattern below keeps Node-only imports out of the edge
 * bundle: the scheduler bootstrap lives in ./instrumentation-node.ts and
 * is only imported when NEXT_RUNTIME is explicitly "nodejs". Next's
 * bundler dead-code-eliminates the dynamic import for the edge build when
 * the condition is provably false.
 *
 * Defense in depth: a few commonly-hit API routes (like the Pulse
 * activity stream poll) also call startWorkflowScheduler() idempotently,
 * so if this hook somehow doesn't fire on a given Railway deploy, the
 * scheduler still kicks on within seconds of the admin panel loading.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
