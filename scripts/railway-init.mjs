/**
 * Railway post-deploy initialization script.
 *
 * Runs: prisma generate → prisma db push → prisma db seed (first deploy only).
 * The seed step is skipped if the database already contains an organization,
 * which means it has been seeded before.
 *
 * This script is called by start-production.mjs via SEED_ON_START=true on Railway.
 * It can also be run standalone:
 *   node scripts/railway-init.mjs
 */

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const prismaBin = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");

function run(binPath, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`[railway-init] ${label}...`);
    const child = spawn(process.execPath, [binPath, ...args], {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} exited because of signal ${signal}`));
        return;
      }
      if (code === 0) {
        console.log(`[railway-init] ${label} completed.`);
        resolve();
        return;
      }
      reject(new Error(`${label} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function prismaGenerate() {
  await run(prismaBin, ["generate"], "prisma generate");
}

async function prismaPush() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await run(prismaBin, ["db", "push", "--skip-generate"], `prisma db push (attempt ${attempt}/3)`);
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`[railway-init] Retrying in 5 seconds...`);
      await delay(5000);
    }
  }
}

async function prismaSeed() {
  // Check if the database has already been seeded by querying for organizations.
  // We do this by running a quick Prisma query via a child process.
  const checkResult = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "-e",
        `
        const { PrismaClient } = require("@prisma/client");
        const prisma = new PrismaClient();
        prisma.organization.count()
          .then((count) => { console.log(count); process.exit(0); })
          .catch(() => { console.log("0"); process.exit(0); })
          .finally(() => prisma.$disconnect());
        `,
      ],
      { cwd: projectRoot, env: process.env, stdio: ["ignore", "pipe", "inherit"] }
    );

    let output = "";
    child.stdout.on("data", (data) => { output += data.toString(); });
    child.on("exit", () => resolve(output.trim()));
  });

  const existingCount = parseInt(checkResult, 10) || 0;

  if (existingCount > 0) {
    console.log(`[railway-init] Database already seeded (${existingCount} organization(s) found). Skipping seed.`);
    return;
  }

  console.log("[railway-init] First deploy detected — running seed...");
  await run(prismaBin, ["db", "seed"], "prisma db seed");
}

try {
  console.log("[railway-init] Starting Railway initialization...");
  await prismaGenerate();
  await prismaPush();
  await prismaSeed();
  console.log("[railway-init] Initialization complete.");
} catch (error) {
  console.error("[railway-init] FATAL:", error instanceof Error ? error.message : error);
  process.exit(1);
}
