import { db } from "@/lib/db";
import { requireServerSession } from "@/lib/auth/server-session";
import { AdminShell } from "@/components/admin/AdminShell";
import { getPendingCount } from "@/lib/repository/approvals";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireServerSession();

  const [adminUser, pendingApprovalsCount] = await Promise.all([
    db.missionControlAdminUser.findUnique({
      where: {
        id: session.userId
      },
      select: {
        displayName: true
      }
    }),
    session.organizationId
      ? getPendingCount(
          session.organizationId,
          session.role === "admin" ? session.businessIds : undefined
        )
      : Promise.resolve(0)
  ]);

  const shellSession = {
    ...session,
    displayName: adminUser?.displayName ?? null,
    pendingApprovalsCount
  };

  return (
    <div className="h-screen overflow-hidden">
      <AdminShell session={shellSession}>{children}</AdminShell>
    </div>
  );
}
