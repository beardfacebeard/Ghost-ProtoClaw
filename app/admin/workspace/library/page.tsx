import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SectionHeader } from "@/components/admin/SectionHeader";
import { WorkspaceLibraryClient } from "@/components/admin/library/WorkspaceLibraryClient";
import { Button } from "@/components/ui/button";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import {
  getWorkspaceLibrary,
  getWorkspaceLibraryCategories,
  getWorkspaceLibrarySources
} from "@/lib/library/workspace-library";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    businessId?: string;
  };
};

export default async function WorkspaceLibraryPage({ searchParams }: PageProps) {
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

  const items = getWorkspaceLibrary();
  const categories = getWorkspaceLibraryCategories();
  const sources = getWorkspaceLibrarySources();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <SectionHeader
          title="Workspace Library"
          description="Starter SOPs, runbooks, playbooks, and templates from every business template plus the Solopreneur Growth Stack. Preview, select, and push into any business."
        />
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/workspace">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Workspace
          </Link>
        </Button>
      </div>

      <WorkspaceLibraryClient
        items={items}
        categories={categories}
        sources={sources}
        businesses={businesses}
        defaultBusinessId={defaultBusinessId}
      />
    </div>
  );
}
