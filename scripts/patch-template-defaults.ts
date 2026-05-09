/* eslint-disable no-console */
// Patch every active template's `defaults` block in business-templates.ts to
// pin primaryModel + fallbackModel and seed per-template spendCeilings.
// Idempotent — re-runs are safe (each insertion checks for existing field).
//
// Run: npx tsx scripts/patch-template-defaults.ts

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type SpendCeilings = {
  weeklyVideoGen?: number;
  weeklyColdEmail?: number;
  weeklySmsBlast?: number;
  weeklyImageGen?: number;
  weeklyVoiceGen?: number;
  monthlyTotalCap?: number;
};

const SPEND_CEILINGS: Record<string, SpendCeilings> = {
  business_builder: { monthlyTotalCap: 100 },
  service_business: { monthlyTotalCap: 300 },
  ecommerce: { weeklyImageGen: 50, monthlyTotalCap: 400 },
  content_creator: { monthlyTotalCap: 400 },
  agency: { weeklyColdEmail: 200, monthlyTotalCap: 600 },
  ghost_operator: { weeklyVideoGen: 100, monthlyTotalCap: 500 },
  high_ticket_coaching: { monthlyTotalCap: 300 },
  skool_community: { monthlyTotalCap: 300 },
  real_estate: { monthlyTotalCap: 300 },
  local_service: { monthlyTotalCap: 300 },
  saas_product: { monthlyTotalCap: 300 },
  social_media_agency: { weeklyVideoGen: 300, monthlyTotalCap: 1500 },
  tiktok_shop: { weeklyVideoGen: 300, weeklyColdEmail: 50, monthlyTotalCap: 1500 },
  faceless_youtube: { weeklyVideoGen: 200, weeklyVoiceGen: 100, monthlyTotalCap: 800 },
  forex_trading_desk: { monthlyTotalCap: 300 },
  dealhawk_empire: { weeklyColdEmail: 100, weeklySmsBlast: 50, monthlyTotalCap: 500 },
  local_lead_gen: { weeklyColdEmail: 50, monthlyTotalCap: 300 },
  pinterest_traffic: { weeklyImageGen: 100, monthlyTotalCap: 300 }
};

const PRIMARY_MODEL = "anthropic/claude-sonnet-4.5";
const FALLBACK_MODEL = "anthropic/claude-haiku-4.5";

const filePath = join(
  process.cwd(),
  "lib/templates/business-templates.ts"
);

const original = readFileSync(filePath, "utf8");
const lines = original.split("\n");

type TemplateRange = {
  id: string;
  defaultsStart: number; // line index (0-based) of "    defaults: {"
  defaultsEnd: number; // line index of closing "    },"
};

function findTemplateRanges(): TemplateRange[] {
  const out: TemplateRange[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s+id:\s*"([a-z_]+)",\s*$/);
    if (!m) continue;
    const id = m[1];

    // Walk forward to find this template's `    defaults: {` line.
    let defaultsStart = -1;
    for (let j = i; j < Math.min(i + 200, lines.length); j++) {
      if (/^\s{4}defaults:\s*\{\s*$/.test(lines[j])) {
        defaultsStart = j;
        break;
      }
    }
    if (defaultsStart === -1) continue;

    // Empty defaults `    defaults: {},` — skip patching, e.g. blank.
    if (
      lines[defaultsStart].trim() === "defaults: {},"
    ) {
      continue;
    }

    // Walk forward from defaultsStart to find the matching closing brace.
    // We track brace depth assuming the file is well-formed.
    let depth = 1;
    let defaultsEnd = -1;
    for (let j = defaultsStart + 1; j < lines.length; j++) {
      // Count braces only outside strings — approximate but works for the
      // hand-authored shape of business-templates.ts.
      const stripped = lines[j].replace(/"(?:\\.|[^"\\])*"/g, "");
      for (const ch of stripped) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            defaultsEnd = j;
            break;
          }
        }
      }
      if (defaultsEnd !== -1) break;
    }
    if (defaultsEnd === -1) continue;

    out.push({ id, defaultsStart, defaultsEnd });
  }
  return out;
}

const ranges = findTemplateRanges();
console.log(`Found ${ranges.length} template defaults blocks.`);

// Process in REVERSE order so line numbers stay valid as we splice.
let touched = 0;
for (let r = ranges.length - 1; r >= 0; r--) {
  const { id, defaultsStart, defaultsEnd } = ranges[r];
  const block = lines.slice(defaultsStart, defaultsEnd + 1).join("\n");

  const hasPrimary = /primaryModel:/.test(block);
  const hasFallback = /fallbackModel:/.test(block);
  const hasSpend = /spendCeilings:/.test(block);

  if (hasPrimary && hasFallback && hasSpend) {
    console.log(`  · ${id}: already complete`);
    continue;
  }

  const insertions: string[] = [];
  if (!hasPrimary) {
    insertions.push(`      primaryModel: "${PRIMARY_MODEL}"`);
  }
  if (!hasFallback) {
    insertions.push(`      fallbackModel: "${FALLBACK_MODEL}"`);
  }
  if (!hasSpend) {
    const sc = SPEND_CEILINGS[id];
    if (!sc) {
      console.log(`  ! ${id}: no spend-ceiling preset; skipping spendCeilings`);
    } else {
      const fields = Object.entries(sc)
        .map(([k, v]) => `        ${k}: ${v}`)
        .join(",\n");
      insertions.push(`      spendCeilings: {\n${fields}\n      }`);
    }
  }

  // We need to insert before the closing `    },` line of defaults.
  // The line BEFORE defaultsEnd is the last property line of defaults —
  // append a comma if missing, then add our new fields after it.
  const lastPropIdx = defaultsEnd - 1;
  const lastProp = lines[lastPropIdx];
  if (!lastProp.trimEnd().endsWith(",")) {
    lines[lastPropIdx] = lastProp.replace(/(\S)\s*$/, "$1,");
  }
  // Splice in the new lines just BEFORE defaultsEnd, joining with comma.
  const block2 = insertions.join(",\n");
  lines.splice(defaultsEnd, 0, block2);
  console.log(
    `  ✓ ${id}: inserted ${insertions.length} field(s) at line ${defaultsEnd + 1}`
  );
  touched++;
}

if (touched === 0) {
  console.log("\nNo changes needed.");
} else {
  writeFileSync(filePath, lines.join("\n"), "utf8");
  console.log(`\nWrote ${filePath}.`);
}
