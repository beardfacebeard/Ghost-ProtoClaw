/* eslint-disable no-console */
// Verify Phase 2 + Phase 3 audit fixes landed correctly.
// Run: npx tsx scripts/verify-phase2-3.ts

import {
  BUSINESS_TEMPLATES,
  composeAgentSystemPrompt,
  composeTemplateWebhookGuide
} from "../lib/templates/business-templates";
import { TIPTAX_AFFILIATE_ENGINE } from "../lib/templates/tiptax-affiliate-engine";
import {
  COMPLIANCE_OFFICER_BASE,
  FINANCE_ANALYST_BASE,
  CUSTOMER_SERVICE_BASE,
  OUTREACH_MANAGER_BASE,
  TWELVE_WEEK_ROADMAP_TEMPLATE
} from "../lib/templates/primitives";
import { getDemoSeedTemplateIds } from "../lib/templates/demo-seed";

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

const allTemplates = [...BUSINESS_TEMPLATES, TIPTAX_AFFILIATE_ENGINE];

console.log("Phase 2 + Phase 3 verification");
console.log("=".repeat(60));

// ── S-7 agentRole audit (re-verify) ──────────────────────────────
console.log("\nS-7: agentRole on every workflow");
{
  let missing = 0;
  let total = 0;
  for (const t of allTemplates) {
    if (t.id === "blank") continue;
    for (const w of t.starterWorkflows) {
      total++;
      if (!w.agentRole) missing++;
    }
  }
  check(`every workflow has agentRole (${total} workflows)`, missing === 0, `${missing} missing`);
}

// ── S-6 voice rewrite (spot-check premium markers) ───────────────
console.log("\nS-6: premium voice markers on rewritten templates");
const premiumMarkers = [
  "load-bearing metric",
  "operating system",
  "operating rule",
  "five metrics",
  "five load-bearing",
  "non-negotiable",
  "load-bearing"
];
const rewrittenTemplates = [
  "business_builder",
  "service_business",
  "ecommerce",
  "agency",
  "high_ticket_coaching",
  "skool_community",
  "real_estate",
  "local_service",
  "saas_product",
  "social_media_agency"
];
for (const id of rewrittenTemplates) {
  const t = BUSINESS_TEMPLATES.find((x) => x.id === id);
  if (!t) {
    check(`${id} exists`, false);
    continue;
  }
  const prompt = t.systemPromptTemplate ?? "";
  const hasPremiumMarker = premiumMarkers.some((m) =>
    prompt.toLowerCase().includes(m.toLowerCase())
  );
  check(`${id} systemPromptTemplate carries premium voice marker`, hasPremiumMarker);
}

// ── Phase 2 missing workflows ────────────────────────────────────
console.log("\nPhase 2: net-new workflows landed");
const expectedNewWorkflows: { templateId: string; name: string }[] = [
  { templateId: "local_lead_gen", name: "Daily GBP Health Check" },
  { templateId: "local_lead_gen", name: "Weekly Lead-Classification Audit" },
  { templateId: "local_lead_gen", name: "GBP Suspension + Penalty Auto-Detection" },
  { templateId: "social_media_agency", name: "New Client Onboarding Auto-Trigger" },
  { templateId: "social_media_agency", name: "Agency Self-Marketing Engine" },
  { templateId: "social_media_agency", name: "Approval-Deadline Tracking" },
  { templateId: "real_estate", name: "Referral Request Cadence" },
  { templateId: "real_estate", name: "New Listing Compliance Sweep" },
  { templateId: "skool_community", name: "Member Referral Cadence" },
  { templateId: "skool_community", name: "Multi-Cohort Engagement Rotation" },
  { templateId: "skool_community", name: "Content Moderation Sweep" },
  { templateId: "high_ticket_coaching", name: "Discovery Call Transcription + Brief" },
  { templateId: "high_ticket_coaching", name: "Launch Sequence — 14-Day Enrollment Window" },
  { templateId: "high_ticket_coaching", name: "Referral Re-Engagement Sequence" },
  { templateId: "faceless_youtube", name: "Compliance Pre-Publish Gate" }
];
for (const { templateId, name } of expectedNewWorkflows) {
  const t = BUSINESS_TEMPLATES.find((x) => x.id === templateId);
  const w = t?.starterWorkflows.find((x) => x.name === name);
  check(`${templateId} :: '${name}' exists`, !!w);
}

// ── Phase 2 missing KBs ──────────────────────────────────────────
console.log("\nPhase 2: net-new KBs landed");
const expectedNewKbs: { templateId: string; title: string }[] = [
  { templateId: "real_estate", title: "Buyer journey — from first touch to closing" },
  { templateId: "real_estate", title: "Seller journey — from listing prep to closing" },
  { templateId: "real_estate", title: "Fair Housing + state compliance rules" },
  { templateId: "local_service", title: "Commercial vs residential service split" },
  { templateId: "local_service", title: "Emergency dispatch protocol" },
  {
    templateId: "faceless_youtube",
    title: "fal.ai + Replicate + ElevenLabs version pin reference (2026)"
  }
];
for (const { templateId, title } of expectedNewKbs) {
  const t = BUSINESS_TEMPLATES.find((x) => x.id === templateId);
  const kb = t?.starterKnowledge.find((x) => x.title === title);
  check(`${templateId} :: KB '${title}' exists`, !!kb);
}

// ── P-1..P-7 reusable primitives ─────────────────────────────────
console.log("\nP-1 to P-7: reusable primitives module");
check(
  "COMPLIANCE_OFFICER_BASE has systemPromptTemplate",
  !!COMPLIANCE_OFFICER_BASE.systemPromptTemplate
);
check(
  "FINANCE_ANALYST_BASE has systemPromptTemplate",
  !!FINANCE_ANALYST_BASE.systemPromptTemplate
);
check(
  "CUSTOMER_SERVICE_BASE has systemPromptTemplate",
  !!CUSTOMER_SERVICE_BASE.systemPromptTemplate
);
check(
  "OUTREACH_MANAGER_BASE has systemPromptTemplate",
  !!OUTREACH_MANAGER_BASE.systemPromptTemplate
);
check(
  "TWELVE_WEEK_ROADMAP_TEMPLATE has 12-week structure",
  TWELVE_WEEK_ROADMAP_TEMPLATE.includes("Week | Milestone")
);

// ── E1-11 etsy_digital_studio template ───────────────────────────
console.log("\nE1-11: etsy_digital_studio sibling template");
const etsy = BUSINESS_TEMPLATES.find((x) => x.id === "etsy_digital_studio");
check("etsy_digital_studio template exists", !!etsy);
check("etsy_digital_studio has 5 starterAgents", (etsy?.starterAgents.length ?? 0) === 5);
check(
  "etsy_digital_studio Stripe is suggested (not required)",
  !etsy?.requiredIntegrations?.includes("stripe_mcp") &&
    (etsy?.suggestedIntegrations?.includes("stripe_mcp") ?? false)
);
check(
  "ecommerce description points to etsy_digital_studio for Etsy operators",
  (BUSINESS_TEMPLATES.find((x) => x.id === "ecommerce")?.description ?? "").includes(
    "Etsy Digital Studio"
  )
);

// ── E1-5 tiptax tools no longer reference database_query ─────────
console.log("\nE1-5: tiptax tool migration");
let tiptaxStaleRefs = 0;
for (const a of TIPTAX_AFFILIATE_ENGINE.starterAgents) {
  if (a.tools?.includes("database_query")) {
    tiptaxStaleRefs++;
    console.log(`  · stale database_query in ${a.displayName}.tools`);
  }
}
check(`tiptax_affiliate_engine: 0 agent.tools[] reference database_query`, tiptaxStaleRefs === 0);

// ── Demo-seed coverage ───────────────────────────────────────────
console.log("\nDemo-seed coverage");
const seedIds = getDemoSeedTemplateIds();
const expectedSeedIds = [
  "tiktok_shop",
  "faceless_youtube",
  "content_creator",
  "local_lead_gen"
];
for (const id of expectedSeedIds) {
  check(`demo seed registered for ${id}`, seedIds.includes(id));
}

// ── composeAgentSystemPrompt still works on every agent ──────────
console.log("\nE0-3 still passes: composeAgentSystemPrompt on every agent");
let composeFailures = 0;
let agentCount = 0;
for (const t of allTemplates) {
  if (t.id === "blank") continue;
  for (const a of t.starterAgents) {
    agentCount++;
    const prompt = composeAgentSystemPrompt(t, a);
    if (!prompt.includes("── TOOLS YOU HAVE AT RUNTIME ──")) {
      composeFailures++;
    }
  }
}
check(`composeAgentSystemPrompt on ${agentCount} agents`, composeFailures === 0);

// ── composeTemplateWebhookGuide still works ──────────────────────
console.log("\nE0-6 still passes: composeTemplateWebhookGuide on every template");
let webhookGuideFailures = 0;
for (const t of BUSINESS_TEMPLATES) {
  if (t.id === "blank") continue;
  const hasWebhooks = t.starterWorkflows.some((w) => w.trigger === "webhook");
  const guide = composeTemplateWebhookGuide(t);
  if (hasWebhooks && !guide) webhookGuideFailures++;
  if (!hasWebhooks && guide) webhookGuideFailures++;
}
check(`composeTemplateWebhookGuide correctness`, webhookGuideFailures === 0);

// ── forex_trading_desk is private ────────────────────────────────
console.log("\nE1-4: forex_trading_desk retired from public");
const forex = BUSINESS_TEMPLATES.find((x) => x.id === "forex_trading_desk");
check("forex_trading_desk visibility = private", forex?.visibility === "private");
check(
  "forex_trading_desk has ownerEmails",
  (forex?.ownerEmails ?? []).length > 0
);

console.log("\n" + "=".repeat(60));
console.log(`Passed: ${pass}   Failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
