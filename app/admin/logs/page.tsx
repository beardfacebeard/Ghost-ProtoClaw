import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminLogsPage() {
  redirect("/admin/activity?tab=log");
}
