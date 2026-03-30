import { SectionHeader } from "@/components/admin/SectionHeader";
import { MemoryPageClient } from "@/components/admin/memory/MemoryPageClient";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { listAgentMemories } from "@/lib/repository/memory";

export const dynamic = "force-dynamic";

type MemoryPageProps = {
  searchParams?: {
    businessId?: string;
  };
};

export default async function MemoryPage({ searchParams }: MemoryPageProps) {
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

  const [agents, memories] = selectedBusinessId
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
        listAgentMemories({
          organizationId: session.organizationId,
          businessId: selectedBusinessId
        })
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agent Memory"
        description="View and manage what your agents remember across conversations"
      />

      <MemoryPageClient
        businesses={businesses}
        agents={agents}
        selectedBusinessId={selectedBusinessId}
        memories={memories}
      />
    </div>
  );
}
