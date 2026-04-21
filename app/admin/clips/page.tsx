import { SectionHeader } from "@/components/admin/SectionHeader";
import { VideoClipsClient } from "@/components/admin/clips/VideoClipsClient";
import type { VideoClipTarget } from "@/components/admin/clips/VideoClipsClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function VideoClipsPage() {
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
          type: "video_clip"
        },
        orderBy: { createdAt: "desc" },
        take: 300
      })
    : [];

  const targets: VideoClipTarget[] = rows
    .filter(
      (row): row is typeof row & { businessId: string } =>
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
        (row.metadata as VideoClipTarget["metadata"] | null) ??
        ({} as VideoClipTarget["metadata"])
    }));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Automate · Video Clips"
        title="Clip-worthy moments."
        description="Timestamps your agents pulled from long-form videos. Copy the mark, jump to the source, cut in your editor. We never auto-cut."
      />
      <VideoClipsClient targets={targets} />
    </div>
  );
}
