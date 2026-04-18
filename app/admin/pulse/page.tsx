import { requireServerSession } from "@/lib/auth/server-session";
import { db } from "@/lib/db";
import { ActivityView } from "@/components/admin/activity/ActivityView";

export const dynamic = "force-dynamic";

export default async function PulsePage() {
  const session = await requireServerSession();
  if (!session.organizationId) {
    return null;
  }

  const businesses = await db.business.findMany({
    where: {
      organizationId: session.organizationId,
      ...(session.role === "admin" && session.businessIds
        ? { id: { in: session.businessIds } }
        : {})
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  return <ActivityView businesses={businesses} />;
}
