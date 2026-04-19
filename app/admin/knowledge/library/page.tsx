import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SectionHeader } from "@/components/admin/SectionHeader";
import { KnowledgeLibraryClient } from "@/components/admin/library/KnowledgeLibraryClient";
import { Button } from "@/components/ui/button";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import {
  getKnowledgeLibrary,
  getKnowledgeLibraryCategories
} from "@/lib/library/knowledge-library";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    businessId?: string;
  };
};

export default async function KnowledgeLibraryPage({ searchParams }: PageProps) {
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

  const defaultBusinessId =
    businesses.find((b) => b.id === searchParams?.businessId)?.id ??
    businesses[0]?.id ??
    null;

  const items = getKnowledgeLibrary();
  const categories = getKnowledgeLibraryCategories();
  const sources = Array.from(new Set(items.map((item) => item.source))).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader
          title="Knowledge Library"
          description="Browse every starter knowledge entry across all templates plus the Solopreneur Growth Stack. Select multiple and push them into any business."
        />
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/knowledge">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Knowledge
          </Link>
        </Button>
      </div>

      <KnowledgeLibraryClient
        items={items}
        categories={categories}
        sources={sources}
        businesses={businesses}
        defaultBusinessId={defaultBusinessId}
      />
    </div>
  );
}
