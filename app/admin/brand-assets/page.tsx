import { SectionHeader } from "@/components/admin/SectionHeader";
import { BrandAssetsClient } from "@/components/admin/brand-assets/BrandAssetsClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { isR2Configured } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

export default async function BrandAssetsPage() {
  const session = await requireServerSession();
  if (!session.organizationId) return null;

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: { in: session.businessIds }
        }
      : { organizationId: session.organizationId };

  const businesses = await db.business.findMany({
    where: businessWhere,
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  const businessIds = businesses.map((b) => b.id);
  const nameById = new Map(businesses.map((b) => [b.id, b.name]));

  const rows = businessIds.length
    ? await db.brandAsset.findMany({
        where: {
          organizationId: session.organizationId,
          businessId: { in: businessIds }
        },
        orderBy: { createdAt: "desc" },
        take: 300,
        select: {
          id: true,
          businessId: true,
          fileName: true,
          fileType: true,
          mimeType: true,
          fileSize: true,
          url: true,
          description: true,
          category: true,
          createdAt: true
        }
      })
    : [];

  const assets = rows.map((row) => ({
    id: row.id,
    businessId: row.businessId,
    businessName: nameById.get(row.businessId) ?? "Unknown business",
    fileName: row.fileName,
    fileType: row.fileType,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    url: row.url,
    description: row.description,
    category: row.category,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt)
  }));

  const r2Configured = await isR2Configured(session.organizationId);
  const defaultBusinessId = businesses[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Brand Assets"
        description="Logos, brand guides, product shots, marketing media, and docs your agents can reference. Upload once, tag with a category, and agents automatically see them on every chat turn. They'll use what's here before generating something new."
      />
      <BrandAssetsClient
        businesses={businesses}
        defaultBusinessId={defaultBusinessId}
        assets={assets}
        r2Configured={r2Configured}
      />
    </div>
  );
}
