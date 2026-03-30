import { db } from "@/lib/db";

export async function findAdminUserByEmail(email: string) {
  return db.missionControlAdminUser.findFirst({
    where: {
      email: {
        equals: email.toLowerCase(),
        mode: "insensitive"
      }
    },
    include: {
      organization: {
        select: {
          id: true,
          planTier: true
        }
      }
    }
  });
}

export async function findAdminUserForMagic(params: {
  userId?: string;
  email?: string;
}) {
  if (params.userId) {
    return db.missionControlAdminUser.findUnique({
      where: {
        id: params.userId
      },
      include: {
        organization: {
          select: {
            id: true,
            planTier: true
          }
        }
      }
    });
  }

  if (params.email) {
    return findAdminUserByEmail(params.email);
  }

  return null;
}

export function buildSessionData(
  user: NonNullable<Awaited<ReturnType<typeof findAdminUserByEmail>>>
) {
  return {
    userId: user.id,
    email: user.email,
    role: (user.role === "super_admin" ? "super_admin" : "admin") as
      | "super_admin"
      | "admin",
    organizationId: user.organizationId ?? null,
    businessIds: user.businessIds,
    planTier: user.organization?.planTier ?? "app_only"
  };
}
