import { redirect } from "next/navigation";
import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { OrgChartClient } from "@/components/admin/agents/OrgChartClient";

export const dynamic = "force-dynamic";

export default async function OrgChartPage() {
  const session = await requireServerSession();

  if (!session.organizationId) {
    redirect("/admin/agents");
  }

  const agents = await db.agent.findMany({
    where: {
      organizationId: session.organizationId,
      ...(session.role === "admin"
        ? { businessId: { in: session.businessIds } }
        : {})
    },
    select: {
      id: true,
      displayName: true,
      emoji: true,
      role: true,
      type: true,
      status: true,
      parentAgentId: true,
      depth: true,
      business: {
        select: { id: true, name: true }
      },
      _count: {
        select: {
          agentMemories: true,
          actionRuns: true
        }
      }
    },
    orderBy: [{ type: "asc" }, { displayName: "asc" }]
  });

  return <OrgChartClient agents={agents} />;
}
