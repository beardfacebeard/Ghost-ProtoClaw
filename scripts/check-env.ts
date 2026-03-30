import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type Spec = {
  key: string;
  required: boolean;
  description: string;
};

function parseExampleFile(filePath: string) {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const specs: Spec[] = [];
  let pendingMeta: Pick<Spec, "required" | "description"> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# Required:")) {
      pendingMeta = {
        required: true,
        description: trimmed.replace("# Required:", "").trim()
      };
      continue;
    }

    if (trimmed.startsWith("# Optional:")) {
      pendingMeta = {
        required: false,
        description: trimmed.replace("# Optional:", "").trim()
      };
      continue;
    }

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Z0-9_]+)=/);
    if (!match) {
      continue;
    }

    specs.push({
      key: match[1],
      required: pendingMeta?.required ?? false,
      description: pendingMeta?.description ?? ""
    });
    pendingMeta = null;
  }

  return specs;
}

function loadDotEnv(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquoted = rawValue.replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = unquoted;
    }
  }
}

const projectRoot = process.cwd();
const examplePath = path.join(projectRoot, ".env.example");
const envPath = path.join(projectRoot, ".env");
const aliasMap: Record<string, string[]> = {
  SESSION_SECRET: ["MISSION_CONTROL_SESSION_SECRET"],
  ENCRYPTION_KEY: ["INTEGRATION_ENCRYPTION_KEY"]
};

loadDotEnv(envPath);

const specs = parseExampleFile(examplePath);
const rows = specs.map((spec) => {
  const value =
    process.env[spec.key] ??
    aliasMap[spec.key]?.map((alias) => process.env[alias]).find(Boolean);
  const present = typeof value === "string" && value.length > 0;

  return {
    Variable: spec.key,
    Status: present ? "PRESENT" : spec.required ? "MISSING" : "OPTIONAL",
    Required: spec.required ? "yes" : "no",
    Description: spec.description
  };
});

console.table(rows);

const missingRequired = rows.filter(
  (row) => row.Required === "yes" && row.Status === "MISSING"
);

if (missingRequired.length > 0) {
  console.error(
    `Missing ${missingRequired.length} required environment variable(s).`
  );
  process.exit(1);
}

console.log("All required environment variables are present.");
