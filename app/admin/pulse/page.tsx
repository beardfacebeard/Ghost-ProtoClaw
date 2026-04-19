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
    // Break out of the shell's max-w-7xl + py-6 wrapper and pin the Pulse
    // UI to the viewport (minus the TopBar's 4rem). Without this the
    // nested flex + overflow-y-auto containers never get a bounded height,
    // so the list's scroll falls back to the page. Same pattern the chat
    // layout uses.
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] overflow-hidden md:-mx-6">
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
