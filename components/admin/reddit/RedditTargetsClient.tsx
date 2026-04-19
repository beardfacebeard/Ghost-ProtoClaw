"use client";

// Kept for back-compat with any direct imports of the old Reddit-only
// client. The new unified component lives in
// components/admin/outreach/OutreachTargetsClient.tsx.

export {
  OutreachTargetsClient as RedditTargetsClient,
  type OutreachTarget as RedditTarget
} from "@/components/admin/outreach/OutreachTargetsClient";
