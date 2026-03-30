import type { SessionPayload } from "@/lib/auth/session";

export type AdminSession = SessionPayload & {
  displayName?: string | null;
  pendingApprovalsCount?: number;
};
