import { requireServerSession } from "@/lib/auth/server-session";
import { CreateBusinessFlow } from "@/components/admin/businesses/CreateBusinessFlow";

export const dynamic = "force-dynamic";

export default async function CreateBusinessPage() {
  const session = await requireServerSession();

  return <CreateBusinessFlow currentUserEmail={session.email} />;
}
