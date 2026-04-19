import { SectionHeader } from "@/components/admin/SectionHeader";
import { R2Uploader } from "@/components/admin/uploads/R2Uploader";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { isR2Configured } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

export default async function UploadsPage() {
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
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  const defaultBusinessId = businesses[0]?.id ?? null;
  const r2Configured = isR2Configured();

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Uploads"
        description="Drop big videos, images, and other assets here. Files upload directly to Cloudflare R2 from your browser — no 25 MB limit, no middle-server bottleneck."
      />
      <R2Uploader
        businesses={businesses}
        defaultBusinessId={defaultBusinessId}
        r2Configured={r2Configured}
      />
    </div>
  );
}
