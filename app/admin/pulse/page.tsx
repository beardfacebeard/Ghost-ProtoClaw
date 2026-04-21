import { redirect } from "next/navigation";

/**
 * The old Pulse page hosted a "neural feed" visualization the founder
 * found ugly and low-signal. In the 2026 redesign, its best bits (live
 * agent activity, active runs) were absorbed into the Dashboard "Now
 * Running" panel and the Activity page.
 *
 * This stub redirects legacy /admin/pulse bookmarks to /admin/activity
 * so nothing 404s while the visual is gone for good.
 */
export default function PulsePage() {
  redirect("/admin/activity");
}
