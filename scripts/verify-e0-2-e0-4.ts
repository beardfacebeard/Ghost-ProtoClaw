/* eslint-disable no-console */
// Verifies E0-2 (universal model pinning) and E0-4 (spend ceilings)
// landed on every active template.
// Run: npx tsx scripts/verify-e0-2-e0-4.ts

import { BUSINESS_TEMPLATES } from "../lib/templates/business-templates";
import { TIPTAX_AFFILIATE_ENGINE } from "../lib/templates/tiptax-affiliate-engine";

const KNOWN_MODELS = new Set([
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-opus-4.5",
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-opus-4.6",
  "anthropic/claude-opus-4.7",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-opus-4",
  "anthropic/claude-3.7-sonnet",
  "anthropic/claude-3.5-haiku"
]);

let pass = 0;
let fail = 0;

const allTemplates = [...BUSINESS_TEMPLATES, TIPTAX_AFFILIATE_ENGINE];

console.log("E0-2 + E0-4 — Universal model pinning + spend ceilings verification");
console.log("=".repeat(70));

for (const t of allTemplates) {
  if (t.id === "blank") {
    console.log(`\n${t.id}: skipping (intentionally empty)`);
    continue;
  }
  console.log(`\n${t.id}:`);
  const d = t.defaults ?? {};
  const primary = d.primaryModel;
  const fallback = (d as any).fallbackModel;
  const spend = (d as any).spendCeilings;

  if (primary && KNOWN_MODELS.has(primary)) {
    console.log(`  ✓ primaryModel = ${primary}`);
    pass++;
  } else {
    console.log(`  ✗ primaryModel missing or unknown: "${primary}"`);
    fail++;
  }
  if (fallback && KNOWN_MODELS.has(fallback)) {
    console.log(`  ✓ fallbackModel = ${fallback}`);
    pass++;
  } else {
    console.log(`  ✗ fallbackModel missing or unknown: "${fallback}"`);
    fail++;
  }
  if (spend && typeof spend === "object" && Object.keys(spend).length > 0) {
    console.log(`  ✓ spendCeilings: ${JSON.stringify(spend)}`);
    pass++;
  } else {
    console.log(`  ✗ spendCeilings missing or empty`);
    fail++;
  }
}

console.log("\n" + "=".repeat(70));
console.log(`Passed: ${pass}   Failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
