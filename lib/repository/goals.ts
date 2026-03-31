import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const goalInclude = {
  _count: { select: { children: true } }
} satisfies Prisma.GoalInclude;

export type GoalWithCounts = Prisma.GoalGetPayload<{
  include: typeof goalInclude;
}>;

export type CreateGoalInput = {
  businessId: string;
  parentGoalId?: string | null;
  title: string;
  description?: string | null;
  targetDate?: Date | null;
};

export type UpdateGoalInput = Partial<Omit<CreateGoalInput, "businessId">> & {
  status?: string;
  progress?: number;
};

export async function listGoals(
  organizationId: string,
  businessIds?: string[]
) {
  return db.goal.findMany({
    where: {
      business: {
        organizationId,
        ...(businessIds ? { id: { in: businessIds } } : {})
      }
    },
    include: {
      ...goalInclude,
      business: { select: { id: true, name: true } }
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
}

export async function getGoalById(
  id: string,
  organizationId: string,
  businessIds?: string[]
) {
  return db.goal.findFirst({
    where: {
      id,
      business: {
        organizationId,
        ...(businessIds ? { id: { in: businessIds } } : {})
      }
    },
    include: {
      ...goalInclude,
      business: { select: { id: true, name: true } },
      children: { include: goalInclude, orderBy: { createdAt: "desc" } }
    }
  });
}

export async function createGoal(data: CreateGoalInput) {
  return db.goal.create({
    data: {
      businessId: data.businessId,
      parentGoalId: data.parentGoalId ?? null,
      title: data.title,
      description: data.description ?? null,
      targetDate: data.targetDate ?? null
    },
    include: goalInclude
  });
}

export async function updateGoal(id: string, data: UpdateGoalInput) {
  const updateData: Prisma.GoalUncheckedUpdateInput = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.parentGoalId !== undefined) updateData.parentGoalId = data.parentGoalId;
  if (data.targetDate !== undefined) updateData.targetDate = data.targetDate;
  if (data.progress !== undefined) updateData.progress = data.progress;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "completed") updateData.completedAt = new Date();
    else updateData.completedAt = null;
  }

  return db.goal.update({
    where: { id },
    data: updateData,
    include: goalInclude
  });
}

export async function deleteGoal(id: string) {
  return db.goal.delete({ where: { id } });
}
