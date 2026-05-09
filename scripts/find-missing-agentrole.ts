/* eslint-disable no-console */
// Audit which workflows lack `agentRole` so the materializer can route
// them to a specialist instead of bottlenecking through the CEO.
//
// Run: npx tsx scripts/find-missing-agentrole.ts
import { BUSINESS_TEMPLATES } from "../lib/templates/business-templates";
import { TIPTAX_AFFILIATE_ENGINE } from "../lib/templates/tiptax-affiliate-engine";

const all = [...BUSINESS_TEMPLATES, TIPTAX_AFFILIATE_ENGINE];
let missing = 0;
let total = 0;
for (const t of all) {
  if (t.id === "blank") continue;
  for (const w of t.starterWorkflows) {
    total++;
    if (!w.agentRole) {
      missing++;
      console.log(`  ${t.id} :: ${w.name}`);
    }
  }
}
console.log(`\nMissing agentRole: ${missing} / ${total} workflows`);
