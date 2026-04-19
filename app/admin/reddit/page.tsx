import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The Reddit-only review page was folded into the unified Outreach
// Targets view. Keep this route as a redirect so bookmarks, library
// copy, and existing workflow outputs that mention /admin/reddit still
// land somewhere sensible.
export default function RedditTargetsRedirect() {
  redirect("/admin/targets");
}
