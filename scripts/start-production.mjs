import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const prismaBin = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

function runNodeBin(binPath, args, label, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binPath, ...args], {
      cwd: projectRoot,
      env: process.env,
      stdio: options.input !== undefined ? ["pipe", "inherit", "inherit"] : "inherit"
    });

    if (options.input !== undefined && child.stdin) {
      child.stdin.write(options.input);
      child.stdin.end();
    }

    child.on("error", (error) => {
      reject(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${label} exited because of signal ${signal}`));
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function waitForDatabase() {
  // Railway can take 30-90 seconds to bring Postgres online on a fresh
  // project. Poll until the database is reachable before running any
  // Prisma commands so we don't burn migration attempts on a cold DB.
  const maxAttempts = 30;
  const delayMs = 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(
        `Checking database connectivity (attempt ${attempt}/${maxAttempts})...`
      );
      await runNodeBin(prismaBin, ["db", "execute", "--stdin"], "db connectivity check", {
        input: "SELECT 1;"
      });
      console.log("Database is reachable.");
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error(
          `Database still unreachable after ${maxAttempts} attempts (${(maxAttempts * delayMs) / 1000}s).`
        );
        throw error;
      }
      console.warn(
        `Database not ready (attempt ${attempt}/${maxAttempts}). Waiting ${delayMs / 1000}s...`
      );
      await delay(delayMs);
    }
  }
}

async function runDatabaseMigrations() {
  const usePush =
    process.env.DATABASE_MIGRATION_MODE === "push" ||
    process.env.PRISMA_USE_DB_PUSH === "true";

  const args = usePush
    ? ["db", "push", "--skip-generate"]
    : ["migrate", "deploy"];
  const label = usePush ? "prisma db push" : "prisma migrate deploy";

  // Wait for the database to be reachable first (handles Railway cold starts)
  try {
    await waitForDatabase();
  } catch (error) {
    console.error(
      "Could not reach the database. Check that your DATABASE_URL environment variable references the correct Postgres service in Railway."
    );
    throw error;
  }

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(`Running ${label} (attempt ${attempt}/${maxAttempts})...`);
      await runNodeBin(prismaBin, args, label);
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        if (!usePush) {
          console.warn(
            "prisma migrate deploy failed. Falling back to prisma db push..."
          );
          try {
            await runNodeBin(
              prismaBin,
              ["db", "push", "--skip-generate"],
              "prisma db push (fallback)"
            );
            return;
          } catch (fallbackError) {
            throw fallbackError;
          }
        }
        throw error;
      }

      console.warn(
        `${label} failed on attempt ${attempt}. Retrying in 10 seconds...`
      );
      await delay(10000);
    }
  }
}

async function maybeSeed() {
  const shouldSeed =
    process.argv.includes("--seed") || process.env.SEED_ON_START === "true";

  if (!shouldSeed) {
    return;
  }

  console.log("Running prisma db seed...");
  await runNodeBin(prismaBin, ["db", "seed"], "prisma db seed");
}

let nextServer = null;

function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down Ghost ProtoClaw...`);

  if (nextServer) {
    nextServer.kill(signal);
    return;
  }

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

try {
  console.log("Ghost ProtoClaw starting up...");
  await runDatabaseMigrations();
  await maybeSeed();

  console.log("Starting Next.js server...");
  nextServer = spawn(process.execPath, [nextBin, "start"], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit"
  });

  nextServer.on("error", (error) => {
    console.error("Next.js server failed to start.");
    console.error(error);
    process.exit(1);
  });

  nextServer.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
