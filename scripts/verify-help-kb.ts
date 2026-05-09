/* eslint-disable no-console */
// Verify the Help knowledge base loads + renders cleanly + contains the
// expected May 2026 audit additions. Catches: malformed sections, missing
// keywords, regressions on article IDs the chatbot might reference.
//
// Run: npx tsx scripts/verify-help-kb.ts

import {
  helpSections,
  renderKnowledgeBase,
  allArticles
} from "../lib/help/knowledge-base";

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

console.log("Help knowledge base verification");
console.log("=".repeat(60));

// ── Structure integrity ─────────────────────────────────────────
console.log("\nStructure");
check("at least 1 section", helpSections.length > 0);
const articles = allArticles();
check(`at least 30 articles total (${articles.length})`, articles.length >= 30);
check(
  "every article has an id",
  articles.every((a) => !!a.id)
);
check(
  "every article has a title",
  articles.every((a) => !!a.title)
);
check(
  "every article has a body",
  articles.every((a) => !!a.body && a.body.length > 50)
);
check(
  "no duplicate article ids",
  new Set(articles.map((a) => a.id)).size === articles.length
);

// ── New articles from May 2026 audit ────────────────────────────
console.log("\nMay 2026 audit additions present");
const expectedNewArticles = [
  "agent-runtime-contract",
  "spend-ceilings",
  "founder-context-kb",
  "webhook-setup",
  "workflow-rerun-dedup",
  "agent-role-routing"
];
for (const id of expectedNewArticles) {
  const a = articles.find((x) => x.id === id);
  check(`'${id}' article exists`, !!a);
  if (a) {
    check(
      `'${id}' is in the core-features section`,
      a.sectionId === "core-features"
    );
  }
}

// ── Changelog updated ───────────────────────────────────────────
console.log("\nChangelog updated with audit content");
const changelog = articles.find((a) => a.id === "what-changed-recently");
check("changelog article exists", !!changelog);
if (changelog) {
  check(
    "changelog references May 2026 audit pass",
    changelog.body.includes("MAY 2026 — LIBRARY-WIDE PREMIUM AUDIT PASS")
  );
  check(
    "changelog mentions etsy_digital_studio",
    changelog.body.toLowerCase().includes("etsy digital studio")
  );
  check(
    "changelog mentions forex retired to private",
    changelog.body.toLowerCase().includes("forex") &&
      changelog.body.toLowerCase().includes("private")
  );
  check(
    "changelog mentions spend ceilings",
    changelog.body.toLowerCase().includes("spend ceilings")
  );
  check(
    "changelog mentions tool enumeration",
    changelog.body.toLowerCase().includes("enumerate")
  );
  check(
    "changelog mentions webhook auto-doc",
    changelog.body.toLowerCase().includes("webhook setup auto-doc")
  );
  check(
    "changelog mentions reusable primitives",
    changelog.body.toLowerCase().includes("reusable primitives")
  );
  check(
    "changelog mentions Reddit MCP rewrite",
    changelog.body.toLowerCase().includes("reddit mcp rewrite") ||
      changelog.body.toLowerCase().includes("snoowrap")
  );
}

// ── Flagship-templates updated ──────────────────────────────────
console.log("\nFlagship templates article updated");
const flagship = articles.find((a) => a.id === "flagship-templates");
check("flagship-templates article exists", !!flagship);
if (flagship) {
  check(
    "flagship article now mentions Etsy Digital Studio",
    flagship.body.includes("ETSY DIGITAL STUDIO")
  );
  check(
    "flagship article keywords include etsy",
    (flagship.keywords ?? []).includes("etsy digital studio")
  );
}

// ── Render the full KB (what the chatbot sees) ─────────────────
console.log("\nrenderKnowledgeBase output");
const rendered = renderKnowledgeBase();
check("rendered KB > 50,000 chars (substantive)", rendered.length > 50_000);
check(
  "rendered KB mentions etsy_digital_studio",
  rendered.toLowerCase().includes("etsy digital studio")
);
check(
  "rendered KB mentions spend ceilings",
  rendered.toLowerCase().includes("spend ceiling")
);
check(
  "rendered KB mentions agentRole / specialist routing",
  rendered.toLowerCase().includes("specialist") &&
    rendered.toLowerCase().includes("agentrole")
);

console.log("\n" + "=".repeat(60));
console.log(`Passed: ${pass}   Failed: ${fail}`);
console.log(`Rendered KB size: ${rendered.length.toLocaleString()} chars`);
console.log(`Total articles: ${articles.length}`);
process.exit(fail === 0 ? 0 : 1);
