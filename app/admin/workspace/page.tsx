import Link from "next/link";
import { BookOpen } from "lucide-react";

import { SectionHeader } from "@/components/admin/SectionHeader";
import { WorkspacePageClient } from "@/components/admin/workspace/WorkspacePageClient";
import { Button } from "@/components/ui/button";
import { getWorkspaceSyncMode } from "@/lib/brain/workspace";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { listWorkspaceDocuments } from "@/lib/repository/workspace";

export const dynamic = "force-dynamic";

type WorkspacePageProps = {
  searchParams?: {
    businessId?: string;
  };
};

export default async function WorkspacePage({
  searchParams
}: WorkspacePageProps) {
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

  const [agents, documents] = selectedBusinessId
    ? await Promise.all([
        db.agent.findMany({
          where: {
            businessId: selectedBusinessId
          },
          select: {
            id: true,
            displayName: true,
            emoji: true
          },
          orderBy: {
            displayName: "asc"
          }
        }),
        listWorkspaceDocuments({
          businessId: selectedBusinessId,
          organizationId: session.organizationId
        })
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Workspace"
        description="Files your agents can read and write at runtime"
        action={
          <Button asChild variant="outline">
            <Link href="/admin/workspace/library">
              <BookOpen className="h-4 w-4 mr-1" />
              Browse Library
            </Link>
          </Button>
        }
      />

      <WorkspacePageClient
        businesses={businesses}
        agents={agents}
        selectedBusinessId={selectedBusinessId}
        documents={documents}
        syncMode={getWorkspaceSyncMode()}
      />
    </div>
  );
}
