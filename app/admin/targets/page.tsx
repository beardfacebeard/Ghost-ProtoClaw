import { SectionHeader } from "@/components/admin/SectionHeader";
import {
  OutreachTargetsClient,
  type OutreachPlatform,
  type OutreachTarget
} from "@/components/admin/outreach/OutreachTargetsClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function normalizePlatform(value: unknown): OutreachPlatform {
  const s = String(value ?? "").toLowerCase();
  if (s.includes("hacker") || s === "hn") return "hackernews";
  if (s.includes("stack")) return "stackoverflow";
  if (s.includes("github") || s === "gh") return "github";
  if (s.includes("reddit")) return "reddit";
  if (!s) return "other";
  return "other";
}

export default async function OutreachTargetsPage() {
  const session = await requireServerSession();

  if (!session.organizationId) {
    return null;
  }

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: { in: session.businessIds }
        }
      : { organizationId: session.organizationId };

  const businesses = await db.business.findMany({
    where: businessWhere,
    select: { id: true, name: true }
  });
  const businessIds = businesses.map((b) => b.id);
  const nameById = new Map(businesses.map((b) => [b.id, b.name]));

  // Query both the new unified type AND the legacy reddit-only type so
  // existing entries keep appearing without a data migration.
  const rows = businessIds.length
    ? await db.activityEntry.findMany({
        where: {
          businessId: { in: businessIds },
          type: { in: ["outreach_target", "reddit_target"] }
        },
        orderBy: { createdAt: "desc" },
        take: 400
      })
    : [];

  const targets: OutreachTarget[] = rows
    .filter(
      (row): row is typeof row & { businessId: string } =>
        typeof row.businessId === "string"
    )
    .map((row) => {
      const meta =
        (row.metadata as OutreachTarget["metadata"] | null) ??
        ({} as OutreachTarget["metadata"]);
      // Legacy reddit_target rows don't have platform in metadata; infer
      // from the type so they still slot into the Reddit tab.
      const platform =
        row.type === "reddit_target"
          ? "reddit"
          : normalizePlatform(meta.platform);
      return {
        id: row.id,
        businessId: row.businessId,
        businessName: nameById.get(row.businessId) ?? "Unknown business",
        status: row.status ?? "pending",
        createdAt:
          row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : String(row.createdAt),
        platform,
        metadata: meta
      };
    });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Outreach Targets"
        description="Drafted replies your scanners found across Reddit, Hacker News, Stack Overflow, and GitHub. Review, copy, and post manually — we never auto-comment."
      />
      <OutreachTargetsClient targets={targets} />
    </div>
  );
}
