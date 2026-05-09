/* eslint-disable no-console */
// Verifies E0-3 — composeAgentSystemPrompt enumerates tool families
// in the materialized systemPrompt for every template + every agent.
// Run: npx tsx scripts/verify-e0-3.ts

import {
  BUSINESS_TEMPLATES,
  composeAgentSystemPrompt
} from "../lib/templates/business-templates";
import { TIPTAX_AFFILIATE_ENGINE } from "../lib/templates/tiptax-affiliate-engine";
import {
  VIDEO_PRODUCTION_TEMPLATES,
  YOUTUBE_API_TEMPLATES
} from "../lib/mcp/tool-registry";

let pass = 0;
let fail = 0;

const allTemplates = [...BUSINESS_TEMPLATES, TIPTAX_AFFILIATE_ENGINE];

console.log("E0-3 — composeAgentSystemPrompt verification");
console.log("=".repeat(60));

for (const t of allTemplates) {
  if (t.id === "blank") continue;
  console.log(`\n${t.id} (${t.starterAgents.length} agents):`);

  for (const a of t.starterAgents) {
    const prompt = composeAgentSystemPrompt(t, a);
    const checks: { label: string; ok: boolean }[] = [
      {
        label: "starts with original systemPromptTemplate",
        ok: prompt.startsWith(a.systemPromptTemplate)
      },
      {
        label: "contains '── TOOLS YOU HAVE AT RUNTIME ──'",
        ok: prompt.includes("── TOOLS YOU HAVE AT RUNTIME ──")
      },
      {
        label: "lists delegate_task family",
        ok: prompt.includes("delegate_task")
      },
      {
        label: "lists knowledge_lookup family",
        ok: prompt.includes("knowledge_lookup")
      }
    ];

    if (VIDEO_PRODUCTION_TEMPLATES.has(t.id)) {
      checks.push({
        label: "video stack header present (template is video-prod)",
        ok: prompt.includes("Video stack (auto-attached")
      });
      checks.push({
        label: "heygen tools listed",
        ok: prompt.includes("heygen_generate_video")
      });
    } else {
      checks.push({
        label: "video stack NOT listed (not a video-prod template)",
        ok: !prompt.includes("Video stack (auto-attached")
      });
    }

    if (YOUTUBE_API_TEMPLATES.has(t.id)) {
      checks.push({
        label: "youtube stack listed",
        ok: prompt.includes("youtube_upload_video")
      });
    }

    if (a.tools && a.tools.length > 0) {
      checks.push({
        label: `lists explicit toolset (${a.tools.length} tools)`,
        ok: prompt.includes("Agent's explicit toolset")
      });
    }

    if (
      t.defaults?.spendCeilings &&
      Object.keys(t.defaults.spendCeilings).length > 0
    ) {
      checks.push({
        label: "COST GUARDRAILS section present",
        ok: prompt.includes("── COST GUARDRAILS ──")
      });
    }

    let allOk = true;
    for (const c of checks) {
      if (!c.ok) {
        console.log(`  ✗ ${a.displayName}: ${c.label}`);
        allOk = false;
        fail++;
      } else {
        pass++;
      }
    }
    if (allOk) {
      console.log(`  ✓ ${a.displayName}: ${checks.length} checks pass`);
    }
  }
}

console.log("\n" + "=".repeat(60));
console.log(`Passed: ${pass}   Failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
