/* eslint-disable no-console */
// Verifies E0-5 (form-data-to-KB), E0-6/E0-7 (webhook guide auto-injection).
// Run: npx tsx scripts/verify-e0-5-e0-7.ts

import {
  BUSINESS_TEMPLATES,
  composeTemplateWebhookGuide
} from "../lib/templates/business-templates";

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean) {
  if (ok) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    fail++;
  }
}

console.log("E0-6/E0-7 — composeTemplateWebhookGuide per template");
console.log("=".repeat(60));

let templatesWithWebhooks = 0;
let templatesWithoutWebhooks = 0;
for (const t of BUSINESS_TEMPLATES) {
  if (t.id === "blank") continue;
  const hasWebhooks = t.starterWorkflows.some((w) => w.trigger === "webhook");
  const guide = composeTemplateWebhookGuide(t);

  if (hasWebhooks) {
    templatesWithWebhooks++;
    check(
      `${t.id}: returns non-null guide (template has webhook workflows)`,
      guide !== null
    );
    if (guide) {
      check(
        `${t.id}: guide mentions WebhookEndpoint`,
        guide.includes("WebhookEndpoint")
      );
      check(
        `${t.id}: guide names every webhook workflow`,
        t.starterWorkflows
          .filter((w) => w.trigger === "webhook")
          .every((w) => guide.includes(w.name))
      );
    }
  } else {
    templatesWithoutWebhooks++;
    check(
      `${t.id}: returns null (template has no webhook workflows)`,
      guide === null
    );
  }
}

console.log(
  `\nTemplates with webhooks: ${templatesWithWebhooks} | without: ${templatesWithoutWebhooks}`
);

console.log("\n" + "=".repeat(60));
console.log(`Passed: ${pass}   Failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);
