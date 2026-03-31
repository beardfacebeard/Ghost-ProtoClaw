import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const skillInclude = {
  _count: { select: { agentSkills: true } }
} satisfies Prisma.SkillInclude;

export type SkillWithCounts = Prisma.SkillGetPayload<{
  include: typeof skillInclude;
}>;

export type CreateSkillInput = {
  organizationId: string;
  name: string;
  description?: string | null;
  category?: string;
  instructions?: string | null;
  config?: Prisma.InputJsonValue;
  isRequired?: boolean;
};

export type UpdateSkillInput = Partial<Omit<CreateSkillInput, "organizationId">> & {
  status?: string;
};

export async function listSkills(organizationId: string) {
  return db.skill.findMany({
    where: { organizationId, status: "active" },
    include: skillInclude,
    orderBy: [{ isRequired: "desc" }, { name: "asc" }]
  });
}

export async function getSkillById(id: string, organizationId: string) {
  return db.skill.findFirst({
    where: { id, organizationId },
    include: {
      ...skillInclude,
      agentSkills: {
        include: {
          agent: { select: { id: true, displayName: true, emoji: true } }
        }
      }
    }
  });
}

export async function createSkill(data: CreateSkillInput) {
  return db.skill.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? "general",
      instructions: data.instructions ?? null,
      config: data.config ?? undefined,
      isRequired: data.isRequired ?? false
    },
    include: skillInclude
  });
}

export async function updateSkill(id: string, data: UpdateSkillInput) {
  return db.skill.update({
    where: { id },
    data,
    include: skillInclude
  });
}

export async function deleteSkill(id: string) {
  return db.skill.update({
    where: { id },
    data: { status: "archived" },
    include: skillInclude
  });
}

export async function assignSkillToAgent(
  agentId: string,
  skillId: string,
  enabled = true
) {
  return db.agentSkill.upsert({
    where: { agentId_skillId: { agentId, skillId } },
    create: { agentId, skillId, enabled },
    update: { enabled }
  });
}

export async function removeSkillFromAgent(agentId: string, skillId: string) {
  return db.agentSkill.delete({
    where: { agentId_skillId: { agentId, skillId } }
  });
}

export async function getAgentSkills(agentId: string) {
  return db.agentSkill.findMany({
    where: { agentId },
    include: {
      skill: { select: { id: true, name: true, description: true, category: true, isRequired: true } }
    }
  });
}
