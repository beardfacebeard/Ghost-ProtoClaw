import { cn } from "@/lib/utils";

/**
 * Animated status indicator. 6px dot with a breathing halo when the
 * status is "live" (running, active, connected). Used in sidebars,
 * activity rows, and throughout the dashboard to signal "something is
 * happening right now" without being obnoxious.
 *
 * Tones map to the semantic token set:
 *   live    — steel-bright, pulsing halo
 *   success — state-success (solid)
 *   warning — state-warning (solid)
 *   danger  — state-danger (solid)
 *   muted   — ink-muted (for "idle" / "queued")
 */
export function StatusDot({
  tone = "muted",
  className
}: {
  tone?: "live" | "success" | "warning" | "danger" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        tone === "live" &&
          "bg-steel-bright shadow-[0_0_6px_var(--steel)] animate-pulse-steel",
        tone === "success" && "bg-state-success",
        tone === "warning" && "bg-state-warning",
        tone === "danger" && "bg-state-danger",
        tone === "muted" && "bg-ink-muted",
        className
      )}
      aria-hidden
    />
  );
}
