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
    // Match /admin/chat/layout.tsx exactly so the feature fills viewport
    // minus the TopBar (4rem) with nested scrollers properly bounded.
    // Only neg-margin the top (shell uses py-6; the bottom 24px fall
    // outside the viewport-sized box we're about to draw anyway).
    <div className="-mx-6 -mt-6 flex h-[calc(100vh-4rem)] overflow-hidden">
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
    </div>
  );
}
