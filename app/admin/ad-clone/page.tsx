import { SectionHeader } from "@/components/admin/SectionHeader";
import { AdClonePageClient } from "@/components/admin/ad-clone/AdClonePageClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type AdClonePageProps = {
  searchParams?: {
    businessId?: string;
  };
};

export default async function AdClonePage({ searchParams }: AdClonePageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    return null;
  }

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: {
            in: session.businessIds,
          },
        }
      : {
          organizationId: session.organizationId,
        };

  const businesses = await db.business.findMany({
    where: businessWhere,
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const selectedBusinessId =
    businesses.find((b) => b.id === searchParams?.businessId)?.id ??
    businesses[0]?.id ??
    null;

  if (!selectedBusinessId) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Ad Clone Tool"
          description="Clone winning ads into AI-generated creative variations"
        />
        <p className="text-sm text-slate-400">
          No businesses found. Create a business first.
        </p>
      </div>
    );
  }

  const [products, brands, projects] = await Promise.all([
    db.adCloneProduct.findMany({
      where: { businessId: selectedBusinessId },
      orderBy: { createdAt: "desc" },
    }),
    db.adCloneBrand.findMany({
      where: { businessId: selectedBusinessId },
      orderBy: { createdAt: "desc" },
    }),
    db.adCloneProject.findMany({
      where: { businessId: selectedBusinessId },
      include: {
        product: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Ad Clone Tool"
        description="Clone winning ads into AI-generated creative variations"
      />

      <AdClonePageClient
        businesses={businesses}
        selectedBusinessId={selectedBusinessId}
        products={products}
        brands={brands}
        projects={projects}
      />
    </div>
  );
}
