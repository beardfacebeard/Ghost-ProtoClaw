/* eslint-disable no-console */
// Verifies the E0-1 bug batch fixes landed correctly.
// Run: npx tsx scripts/verify-e0-1.ts

import { BUSINESS_TEMPLATES } from "../lib/templates/business-templates";
import { TIPTAX_AFFILIATE_ENGINE } from "../lib/templates/tiptax-affiliate-engine";
import { parseEveryInterval } from "../lib/workflows/schedule-parser";

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

function findTemplate(id: string) {
  return BUSINESS_TEMPLATES.find((t) => t.id === id);
}

function findWorkflow(id: string, name: string) {
  const t = findTemplate(id);
  return t?.starterWorkflows.find((w) => w.name === name);
}

console.log("E0-1 — Bug batch verification");
console.log("=".repeat(48));

console.log("\nB-1: tiptax_affiliate_engine.primaryModel set");
check(
  'primaryModel === "anthropic/claude-sonnet-4.5"',
  TIPTAX_AFFILIATE_ENGINE.defaults?.primaryModel === "anthropic/claude-sonnet-4.5",
  `got: "${TIPTAX_AFFILIATE_ENGINE.defaults?.primaryModel}"`
);

console.log("\nB-2: real_estate Past Client Re-Engagement frequency");
{
  const w = findWorkflow("real_estate", "Past Client Re-Engagement");
  check("workflow exists", !!w);
  check('frequency === "monthly"', w?.frequency === "monthly", `got: "${w?.frequency}"`);
}

console.log("\nB-3: service_business Quarterly Business Review frequency");
{
  const w = findWorkflow("service_business", "Quarterly Business Review");
  check("workflow exists", !!w);
  check('frequency === "quarterly"', w?.frequency === "quarterly", `got: "${w?.frequency}"`);
}

console.log("\nB-4: social_media_agency Monthly Client Report frequency");
{
  const w = findWorkflow("social_media_agency", "Monthly Client Report");
  check("workflow exists", !!w);
  check('frequency === "monthly"', w?.frequency === "monthly", `got: "${w?.frequency}"`);
}

console.log("\nB-5: ecommerce SKU_SCORECARD ghost reference removed");
{
  const t = findTemplate("ecommerce");
  const doc = t?.starterWorkspaceDocs.find((d) => d.filePath === "SKU_SCORECARD.md");
  check("SKU_SCORECARD.md exists", !!doc);
  const content = doc?.contentTemplate ?? "";
  const hasGhost = content.includes("Performance Analyst maintains this");
  check("ghost 'Performance Analyst maintains' removed", !hasGhost);
  const hasReassignment = content.includes("Listing Optimizer & Tag Engineer");
  check("reassigned to Listing Optimizer & Tag Engineer", hasReassignment);
}

console.log("\nB-6: local_service requires twilio_mcp");
{
  const t = findTemplate("local_service");
  check(
    "twilio_mcp in requiredIntegrations",
    !!t?.requiredIntegrations?.includes("twilio_mcp")
  );
  check(
    "twilio_mcp NOT in suggestedIntegrations",
    !t?.suggestedIntegrations?.includes("twilio_mcp")
  );
}

console.log("\nB-7: local_lead_gen Contractor Outreach tools[] no longer lists hubspot_mcp");
{
  const t = findTemplate("local_lead_gen");
  const a = t?.starterAgents.find(
    (ag) => ag.role.toLowerCase().includes("contractor") || ag.displayName.toLowerCase().includes("contractor")
  );
  check("Contractor Outreach agent exists", !!a);
  check(
    'tools[] does NOT include "hubspot_mcp"',
    !a?.tools?.includes("hubspot_mcp")
  );
}

console.log("\nB-8: service_business 'Offers and delivery' duplicate removed");
{
  const t = findTemplate("service_business");
  const matches = t?.starterKnowledge.filter(
    (k) => k.title === "Offers and delivery"
  );
  check("zero KB items titled 'Offers and delivery'", (matches?.length ?? 0) === 0);
  const catalog = t?.starterKnowledge.filter(
    (k) => k.title === "Service catalog and pricing"
  );
  check("'Service catalog and pricing' still present", (catalog?.length ?? 0) === 1);
}

console.log("\nB-9: social_media_agency 'Service packages and deliverables' duplicate removed");
{
  const t = findTemplate("social_media_agency");
  const dup = t?.starterKnowledge.filter(
    (k) => k.title === "Service packages and deliverables"
  );
  check("zero KB items titled 'Service packages and deliverables'", (dup?.length ?? 0) === 0);
  const pricing = t?.starterKnowledge.filter(
    (k) => k.title === "Service packages and pricing"
  );
  check("'Service packages and pricing' still present", (pricing?.length ?? 0) === 1);
}

console.log("\nB-10: business_builder workflows have agentRole");
{
  const t = findTemplate("business_builder");
  for (const w of t?.starterWorkflows ?? []) {
    check(`'${w.name}' has agentRole`, !!w.agentRole, `got: ${w.agentRole}`);
  }
}

console.log("\nBonus: schedule-parser handles plain-word frequencies");
for (const word of ["daily", "weekly", "monthly", "quarterly", "yearly"]) {
  const parsed = parseEveryInterval(word);
  check(`parseEveryInterval("${word}") returns non-null`, parsed !== null);
}

console.log("\n" + "=".repeat(48));
console.log(`Passed: ${pass}   Failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
