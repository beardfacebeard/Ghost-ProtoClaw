/* eslint-disable no-console */
// Add `agentRole` to every starterWorkflow that lacks one so the
// materializer routes mechanical workflows to the right specialist
// instead of bottlenecking through the CEO.
//
// Mapping is editorial — each (templateId, workflowName) → agentRole
// reflects which specialist actually owns that workflow in the prose.
//
// Run: npx tsx scripts/patch-agentrole.ts
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Mapping = Record<string, Record<string, string>>;

// agentRole values match against displayName OR role (case-insensitive
// substring) per resolveWorkflowAgentId in business-templates.ts. We use
// the displayName when it's distinctive enough, otherwise a role-substring
// (e.g. "Chief Executive" matches role "Chief Executive Officer — Opportunity Research").
const MAPPING: Mapping = {
  service_business: {
    "New Lead Intake": "Sales & Intake",
    "Weekly Content Queue": "CMO",
    "Follow-up Sequence": "Sales & Intake",
    "Client Onboarding Sequence": "Service Coordinator",
    "Quarterly Business Review": "CEO",
    "Client Health Check": "Service Coordinator"
  },
  ecommerce: {
    "New Order Processing": "Fulfillment & Operations",
    "Abandoned Cart Follow-up": "CMO",
    "Product Review Response": "Customer Support Manager",
    "Weekly Business Health Report": "CEO",
    "Inventory Reorder Alert": "Fulfillment & Operations",
    "Post-Purchase Follow-Up": "Customer Support Manager"
  },
  content_creator: {
    "Weekly Content Plan": "CEO",
    "New Comment Response": "Community Manager",
    "Newsletter Draft": "Content Writer",
    "Trending Topic Brief": "Research Analyst",
    "Content Performance Review": "Research Analyst",
    "Community Engagement Report": "Community Manager"
  },
  agency: {
    "Client Update Report": "Account Manager",
    "New Lead Qualification": "Business Developer",
    "Project Status Summary": "COO",
    "Proposal Draft": "Proposal Writer",
    "New Client Onboarding": "Account Manager",
    "Weekly Leadership Review": "CEO"
  },
  ghost_operator: {
    "Weekly Opportunity Scan": "CEO",
    "Weekly Business Health Report": "CFO",
    "Monthly Strategy Review": "CEO"
  },
  high_ticket_coaching: {
    "New Lead Qualification": "CEO",
    "Weekly Client Check-In": "Client Success",
    "Launch Content Queue": "CMO",
    "Stripe Payment Follow-Up": "CFO"
  },
  skool_community: {
    "New Member Welcome": "Community Manager",
    "Weekly Engagement Post": "Community Manager",
    "Re-Engagement Campaign": "Community Manager",
    "Churn Risk Alert": "Growth Specialist"
  },
  real_estate: {
    "New Lead Follow-Up": "Sales Agent",
    "New Listing Launch": "CMO",
    "Past Client Re-Engagement": "Client Care",
    "Market Update Newsletter": "CMO"
  },
  local_service: {
    "New Inquiry Response": "Sales & Booking",
    "Post-Job Follow-Up": "Reputation Manager",
    "Weekly Booking Summary": "Sales & Booking",
    "Seasonal Promo Campaign": "Marketing Lead"
  },
  saas_product: {
    "New User Activation Check": "CMO",
    "Trial Ending Sequence": "CMO",
    "Churn Risk Detection": "Product Analyst",
    "Weekly Product Health Report": "CEO"
  },
  social_media_agency: {
    "Weekly Content Calendar": "Content Creator",
    "Monthly Client Report": "Analytics Lead",
    "New Client Onboarding Pack": "Account Manager",
    "Trending Content Alert": "Content Creator"
  },
  tiktok_shop: {
    "New SKU Launch Checklist": "Listings Specialist",
    "Daily SPS Watch & Tier Alert": "CEO",
    "Weekly Shop Health Report": "CEO"
  },
  faceless_youtube: {
    "Weekly Outlier Video Mining": "Niche & Packaging Strategist",
    "Research Brief Production": "Research Analyst",
    "Script Draft + HITL Approval Gate": "Script Writer",
    "Voiceover Generation + Whisper Diff": "Voice Director",
    "Visual Asset & Thumbnail Batch": "Visual Producer",
    "Video Assembly Pipeline Run": "Assembly Engineer",
    "Publish + SEO Metadata": "SEO & Publishing Manager",
    "Title + Thumbnail A/B Test": "Niche & Packaging Strategist",
    "48-Hour CTR & Retention Audit": "Analytics & Retention Lead",
    "Shorts Cut + Community Post Campaign": "Community & Shorts Manager",
    "Weekly KPI Dashboard": "Analytics & Retention Lead",
    "20-Video Checkpoint Review": "Studio Head",
    "Sponsor Outreach Pipeline": "Sponsor Hunter",
    "Ghost ProtoClaw / AiFlowlytics Funnel Report": "Funnel Architect",
    "Rights Ledger & Compliance Audit": "Compliance & Rights Officer",
    "Tool Cost & Pipeline Economics Review": "Tool Cost Analyst",
    "Secondary Channel Launch Plan": "Studio Head",
    "Batch Production Cycle": "Assembly Engineer"
  },
  forex_trading_desk: {
    "Morning Briefing": "Macro Researcher",
    "Pre-Event Watch": "Risk Officer",
    "End-of-Day Wrap": "Trade Journaler",
    "Weekly Backtest Audit": "Quant Analyst",
    "Strategy Proposal Intake": "Trading Desk Lead",
    "Monthly Governance Review": "Trading Desk Lead"
  },
  dealhawk_empire: {
    "Daily Deal Digest": "Deal Ops",
    "Weekly Market Heat Map": "Comp",
    "Pre-Foreclosure Sweep": "Distress Signal",
    "Tax Delinquent Pull": "Distress Signal",
    "Probate Monitor": "Distress Signal",
    "MLS Stale & Expired Alerts": "Distress Signal",
    "Absentee Owner Campaign": "Distress Signal",
    "Weekly Pipeline Report": "Deal Ops",
    "Cold Letter Generator & Mail Queue": "Seller Outreach",
    "SMS Blast Sequencer": "Seller Outreach",
    "Offer Letter Generator": "Comp",
    "LOI Generator (Creative Finance)": "Sub-To"
  },
  local_lead_gen: {
    "New Site Launch Sequence": "Site Builder"
  },
  pinterest_traffic: {
    "Seasonal Content Ramp (60-Day Pre-Holiday)": "Pinterest SEO Strategist"
  }
};

const filePath = join(
  process.cwd(),
  "lib/templates/business-templates.ts"
);
const original = readFileSync(filePath, "utf8");
const lines = original.split("\n");

// Strategy: walk top-down, track current template id, current workflow
// name. When we hit a workflow object with no agentRole + a mapping
// exists, splice in `agentRole: "<value>"`.
let currentTemplateId: string | null = null;
let totalAdded = 0;
const out: string[] = [];

for (let i = 0; i < lines.length; i++) {
  out.push(lines[i]);
  const idMatch = lines[i].match(/^\s+id:\s*"([a-z_]+)",\s*$/);
  if (idMatch) {
    currentTemplateId = idMatch[1];
  }
}

// Different approach — process top-down with state machine for each
// workflow block. Reset and walk again with proper splicing.
const finalLines: string[] = [];
currentTemplateId = null;
let inWorkflowsArray = false;
let workflowsArrayDepth = 0;
let inWorkflowBlock = false;
let workflowBlockDepth = 0;
let workflowBlockStart = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const idMatch = line.match(/^\s+id:\s*"([a-z_]+)",\s*$/);
  if (idMatch) {
    currentTemplateId = idMatch[1];
  }

  if (/^\s+starterWorkflows:\s*\[\s*$/.test(line)) {
    inWorkflowsArray = true;
    workflowsArrayDepth = 1;
    finalLines.push(line);
    continue;
  }

  if (inWorkflowsArray) {
    // Track open/close brackets for the array boundary.
    if (line.trim() === "],") {
      // possible close of the workflows array — only at depth 1
      if (workflowsArrayDepth === 1 && !inWorkflowBlock) {
        inWorkflowsArray = false;
        finalLines.push(line);
        continue;
      }
    }

    // Detect start of a workflow object: `      {`
    if (!inWorkflowBlock && /^\s+\{\s*$/.test(line)) {
      inWorkflowBlock = true;
      workflowBlockDepth = 1;
      workflowBlockStart = finalLines.length;
      finalLines.push(line);
      continue;
    }

    if (inWorkflowBlock) {
      // Track nested braces inside the workflow block.
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      workflowBlockDepth += openBraces - closeBraces;

      finalLines.push(line);

      if (workflowBlockDepth === 0) {
        // Workflow block closed. Inspect what we collected.
        const blockLines = finalLines.slice(workflowBlockStart);
        const blockText = blockLines.join("\n");
        const nameMatch = blockText.match(/^\s+name:\s*"([^"]+)",/m);
        const hasAgentRole = /agentRole:/.test(blockText);

        if (
          nameMatch &&
          !hasAgentRole &&
          currentTemplateId &&
          MAPPING[currentTemplateId]?.[nameMatch[1]]
        ) {
          const agentRole = MAPPING[currentTemplateId][nameMatch[1]];
          // Insert `agentRole: "<value>"` BEFORE the closing brace line.
          // The closing brace is the last line in blockLines.
          const closingIdx = finalLines.length - 1;
          // Determine the indent from the previous line.
          const prevLine = finalLines[closingIdx - 1];
          // Ensure the previous line ends with comma.
          if (!/,\s*$/.test(prevLine)) {
            finalLines[closingIdx - 1] = prevLine.replace(/(\S)\s*$/, "$1,");
          }
          // Pull indent off any property line in the block (e.g., `        name: ...`).
          const indentMatch = blockLines.find((l) => /^\s+\w+:/.test(l));
          const indent = indentMatch ? indentMatch.match(/^(\s+)/)?.[1] ?? "        " : "        ";
          finalLines.splice(closingIdx, 0, `${indent}agentRole: "${agentRole}"`);
          totalAdded++;
          console.log(
            `  ✓ ${currentTemplateId} :: ${nameMatch[1]} → ${agentRole}`
          );
        }

        inWorkflowBlock = false;
        workflowBlockDepth = 0;
        workflowBlockStart = -1;
      }
      continue;
    }

    finalLines.push(line);
    continue;
  }

  finalLines.push(line);
}

if (totalAdded === 0) {
  console.log("\nNo workflows needed agentRole insertion.");
} else {
  writeFileSync(filePath, finalLines.join("\n"), "utf8");
  console.log(`\nAdded agentRole to ${totalAdded} workflows.`);
}
