import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const projectListInclude = {
  _count: {
    select: {
      issues: true
    }
  }
} satisfies Prisma.ProjectInclude;

export type ProjectWithCounts = Prisma.ProjectGetPayload<{
  include: typeof projectListInclude;
}>;

export type CreateProjectInput = {
  businessId: string;
  name: string;
  description?: string | null;
  targetDate?: Date | null;
};

export type UpdateProjectInput = Partial<
  Omit<CreateProjectInput, "businessId">
> & {
  status?: string;
};

export async function listProjects(
  organizationId: string,
  businessIds?: string[]
) {
  return db.project.findMany({
    where: {
      business: {
        organizationId,
        ...(businessIds ? { id: { in: businessIds } } : {})
      }
    },
    include: projectListInclude,
    orderBy: { createdAt: "desc" }
  });
}

export async function getProjectById(
  id: string,
  organizationId: string,
  businessIds?: string[]
) {
  return db.project.findFirst({
    where: {
      id,
      business: {
        organizationId,
        ...(businessIds ? { id: { in: businessIds } } : {})
      }
    },
    include: {
      ...projectListInclude,
      business: { select: { id: true, name: true, slug: true } },
      issues: {
        include: {
          assigneeAgent: {
            select: { id: true, displayName: true, emoji: true }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });
}

export async function createProject(data: CreateProjectInput) {
  return db.project.create({
    data: {
      businessId: data.businessId,
      name: data.name,
      description: data.description ?? null,
      targetDate: data.targetDate ?? null
    },
    include: projectListInclude
  });
}

export async function updateProject(id: string, data: UpdateProjectInput) {
  return db.project.update({
    where: { id },
    data,
    include: projectListInclude
  });
}

export async function deleteProject(id: string) {
  return db.project.delete({ where: { id } });
}
