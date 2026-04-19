import Link from "next/link";
import { BookOpen } from "lucide-react";

import { SectionHeader } from "@/components/admin/SectionHeader";
import { KnowledgePageClient } from "@/components/admin/knowledge/KnowledgePageClient";
import { Button } from "@/components/ui/button";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { listKnowledgeItems } from "@/lib/repository/knowledge";

export const dynamic = "force-dynamic";

type KnowledgePageProps = {
  searchParams?: {
    businessId?: string;
  };
};

export default async function KnowledgePage({ searchParams }: KnowledgePageProps) {
  const session = await requireServerSession();

  if (!session.organizationId) {
    return null;
  }

  const businessWhere =
    session.role === "admin"
      ? {
          organizationId: session.organizationId,
          id: {
            in: session.businessIds
          }
        }
      : {
          organizationId: session.organizationId
        };

  const businesses = await db.business.findMany({
    where: businessWhere,
    select: {
      id: true,
      name: true
    },
    orderBy: {
      name: "asc"
    }
  });

  const selectedBusinessId =
    businesses.find((business) => business.id === searchParams?.businessId)?.id ??
    businesses[0]?.id ??
    null;

  const items =
    selectedBusinessId && session.organizationId
      ? await listKnowledgeItems({
          businessId: selectedBusinessId,
          organizationId: session.organizationId
        })
      : [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Knowledge Base"
        description="Structured information your agents use to answer questions and stay on-brand"
        action={
          <Button asChild variant="outline">
            <Link href="/admin/knowledge/library">
              <BookOpen className="h-4 w-4 mr-1" />
              Browse Library
            </Link>
          </Button>
        }
      />

      <KnowledgePageClient
        businesses={businesses}
        selectedBusinessId={selectedBusinessId}
        items={items}
      />
    </div>
  );
}
