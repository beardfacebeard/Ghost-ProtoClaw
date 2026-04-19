/**
 * Node-runtime-only instrumentation.
 *
 * Kept in a separate file from instrumentation.ts so Next.js never tries
 * to bundle node:crypto / node:fs / node:perf_hooks (pulled in
 * transitively through the scheduler) for the edge runtime. This file is
 * only reachable via the `if (NEXT_RUNTIME === "nodejs")` gate in
 * instrumentation.ts, so the edge bundle never evaluates it.
 */
import { startWorkflowScheduler } from "@/lib/workflows/scheduler";

startWorkflowScheduler();
console.log("[instrumentation-node] workflow scheduler bootstrap complete");
