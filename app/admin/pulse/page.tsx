import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { ActivityView } from "@/components/admin/activity/ActivityView";

export const dynamic = "force-dynamic";

export default async function PulsePage() {
  const session = await requireServerSession();
  if (!session.organizationId) {
    return null;
  }

  const [businesses, masterAgent] = await Promise.all([
    db.business.findMany({
      where: {
        organizationId: session.organizationId,
        ...(session.role === "admin" && session.businessIds
          ? { id: { in: session.businessIds } }
          : {})
      },
      select: {
        id: true,
        name: true,
        agents: {
          where: { status: { in: ["active", "paused"] } },
          select: {
            id: true,
            displayName: true,
            emoji: true,
            role: true,
            type: true
          },
          orderBy: [{ type: "asc" }, { displayName: "asc" }]
        }
      },
      orderBy: { name: "asc" }
    }),
    db.agent.findFirst({
      where: {
        organizationId: session.organizationId,
        type: "master",
        businessId: null
      },
      select: {
        id: true,
        displayName: true,
        emoji: true,
        status: true
      }
    })
  ]);

  return (
    <ActivityView
      businesses={businesses.map((b) => ({ id: b.id, name: b.name }))}
      topology={{
        master: masterAgent,
        businesses: businesses.map((b) => ({
          id: b.id,
          name: b.name,
          agents: b.agents
        }))
      }}
    />
  );
}
