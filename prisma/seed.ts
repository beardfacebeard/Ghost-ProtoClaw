import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../lib/auth/crypto";

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function main() {
  const created: string[] = [];

  const organizationCount = await prisma.organization.count();
  let organization = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (organizationCount === 0) {
    const organizationName =
      process.env.MISSION_CONTROL_ADMIN_NAME?.trim() || "My Organization";

    organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: slugify(organizationName) || "my-organization",
        status: "active"
      }
    });

    created.push(`organization:${organization.name}`);
  }

  const adminCount = await prisma.missionControlAdminUser.count();
  const adminEmail = process.env.MISSION_CONTROL_ADMIN_EMAIL?.trim();
  const adminPassword = process.env.MISSION_CONTROL_ADMIN_PASSWORD;
  const adminName = process.env.MISSION_CONTROL_ADMIN_NAME?.trim() || "Admin";

  if (adminCount === 0 && adminEmail) {
    if (!adminPassword) {
      console.warn(
        "MISSION_CONTROL_ADMIN_PASSWORD is missing, so the default admin user was not created."
      );
    } else {
      const passwordHash = await hashPassword(adminPassword);

      await prisma.missionControlAdminUser.create({
        data: {
          organizationId: organization?.id,
          email: adminEmail.toLowerCase(),
          displayName: adminName,
          passwordHash,
          role: "super_admin",
          businessIds: [],
          status: "active"
        }
      });

      created.push(`admin:${adminEmail.toLowerCase()}`);
    }
  }

  if (created.length === 0) {
    console.log("Seed complete. No new records were created.");
    return;
  }

  console.log("Seed complete. Created:");
  created.forEach((entry) => console.log(`- ${entry}`));
}

main()
  .catch((error) => {
    console.error("Seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
