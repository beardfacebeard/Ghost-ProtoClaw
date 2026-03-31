import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const issueListInclude = {
  assigneeAgent: {
    select: { id: true, displayName: true, emoji: true }
  },
  project: {
    select: { id: true, name: true }
  },
  business: {
    select: { id: true, name: true }
  }
} satisfies Prisma.IssueInclude;

export type IssueWithRelations = Prisma.IssueGetPayload<{
  include: typeof issueListInclude;
}>;

export type CreateIssueInput = {
  businessId: string;
  projectId?: string | null;
  assigneeAgentId?: string | null;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  labels?: string[];
  dueDate?: Date | null;
};

export type UpdateIssueInput = Partial<Omit<CreateIssueInput, "businessId">>;

type ListIssuesParams = {
  organizationId: string;
  businessIds?: string[];
  businessId?: string;
  projectId?: string;
  status?: string;
  priority?: string;
  assigneeAgentId?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listIssues(params: ListIssuesParams) {
  const where: Prisma.IssueWhereInput = {
    business: {
      organizationId: params.organizationId,
      ...(params.businessIds ? { id: { in: params.businessIds } } : {})
    },
    ...(params.businessId ? { businessId: params.businessId } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.status && params.status !== "all"
      ? { status: params.status }
      : {}),
    ...(params.priority && params.priority !== "all"
      ? { priority: params.priority }
      : {}),
    ...(params.assigneeAgentId
      ? { assigneeAgentId: params.assigneeAgentId }
      : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: "insensitive" as const } },
            {
              description: {
                contains: params.search,
                mode: "insensitive" as const
              }
            }
          ]
        }
      : {})
  };

  const [issues, total] = await Promise.all([
    db.issue.findMany({
      where,
      include: issueListInclude,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: params.limit ?? 50,
      skip: params.offset ?? 0
    }),
    db.issue.count({ where })
  ]);

  return { issues, total };
}

export async function getIssueById(
  id: string,
  organizationId: string,
  businessIds?: string[]
) {
  return db.issue.findFirst({
    where: {
      id,
      business: {
        organizationId,
        ...(businessIds ? { id: { in: businessIds } } : {})
      }
    },
    include: issueListInclude
  });
}

export async function createIssue(data: CreateIssueInput) {
  return db.issue.create({
    data: {
      businessId: data.businessId,
      projectId: data.projectId ?? null,
      assigneeAgentId: data.assigneeAgentId ?? null,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "open",
      priority: data.priority ?? "medium",
      labels: data.labels ?? [],
      dueDate: data.dueDate ?? null
    },
    include: issueListInclude
  });
}

export async function updateIssue(id: string, data: UpdateIssueInput) {
  const updateData: Prisma.IssueUncheckedUpdateInput = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === "done") {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.projectId !== undefined) updateData.projectId = data.projectId;
  if (data.assigneeAgentId !== undefined)
    updateData.assigneeAgentId = data.assigneeAgentId;
  if (data.labels !== undefined) updateData.labels = data.labels;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;

  return db.issue.update({
    where: { id },
    data: updateData,
    include: issueListInclude
  });
}

export async function deleteIssue(id: string) {
  return db.issue.delete({ where: { id } });
}

export async function getIssueStats(
  organizationId: string,
  businessIds?: string[]
) {
  const businessFilter = {
    business: {
      organizationId,
      ...(businessIds ? { id: { in: businessIds } } : {})
    }
  };

  const [open, inProgress, review, done] = await Promise.all([
    db.issue.count({ where: { ...businessFilter, status: "open" } }),
    db.issue.count({ where: { ...businessFilter, status: "in_progress" } }),
    db.issue.count({ where: { ...businessFilter, status: "review" } }),
    db.issue.count({ where: { ...businessFilter, status: "done" } })
  ]);

  return { open, inProgress, review, done, total: open + inProgress + review + done };
}
