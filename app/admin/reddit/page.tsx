import { SectionHeader } from "@/components/admin/SectionHeader";
import { RedditTargetsClient } from "@/components/admin/reddit/RedditTargetsClient";
import type { RedditTarget } from "@/components/admin/reddit/RedditTargetsClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RedditTargetsPage() {
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

  const rows = businessIds.length
    ? await db.activityEntry.findMany({
        where: {
          businessId: { in: businessIds },
          type: "reddit_target"
        },
        orderBy: { createdAt: "desc" },
        take: 200
      })
    : [];

  const targets: RedditTarget[] = rows
    .filter((row): row is typeof row & { businessId: string } =>
      typeof row.businessId === "string"
    )
    .map((row) => ({
      id: row.id,
      businessId: row.businessId,
      businessName: nameById.get(row.businessId) ?? "Unknown business",
      status: row.status ?? "pending",
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
      metadata:
        (row.metadata as RedditTarget["metadata"] | null) ??
        ({} as RedditTarget["metadata"])
    }));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Reddit Targets"
        description="Drafted replies the Reddit Audience Scanner found for your ICP. Review, copy, and post manually — we never auto-comment."
      />
      <RedditTargetsClient targets={targets} />
    </div>
  );
}
