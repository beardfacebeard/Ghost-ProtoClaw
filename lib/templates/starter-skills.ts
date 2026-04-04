/**
 * Starter Skills
 *
 * Universal skills that are automatically created and assigned to agents
 * when a business is created from a template. Adapted from real-world
 * agent skill patterns — stripped of any external branding.
 */

export type StarterSkillTemplate = {
  name: string;
  description: string;
  category: string;
  instructions: string;
  isRequired: boolean;
  /** Which agent types should receive this skill: "all", "main", or "specialist" */
  assignTo: "all" | "main" | "specialist";
};

export const STARTER_SKILLS: StarterSkillTemplate[] = [
  {
    name: "Heartbeat Check",
    description:
      "Periodic self-check that confirms the agent is active, responsive, and aligned with its current objectives.",
    category: "system",
    instructions:
      "When triggered, confirm you are operational by summarizing: (1) your current role and purpose, (2) the last task you completed or are working on, (3) any blockers or pending approvals, and (4) your top priority for the next cycle. Keep the response under 200 words. If you have no pending work, say so clearly.",
    isRequired: true,
    assignTo: "all"
  },
  {
    name: "Daily Summary",
    description:
      "Generates a concise end-of-day summary of completed tasks, pending items, and recommended next actions.",
    category: "reporting",
    instructions:
      "Produce a structured daily summary with these sections: COMPLETED (what was finished today), PENDING (what is still in progress or waiting on approval), BLOCKED (anything you cannot proceed on and why), and NEXT (the top 3 recommended actions for tomorrow). Use bullet points, keep each item to one sentence, and highlight anything that needs the user's attention.",
    isRequired: false,
    assignTo: "all"
  },
  {
    name: "Task Breakdown",
    description:
      "Breaks a high-level goal or request into specific, actionable sub-tasks with clear ownership and sequencing.",
    category: "operations",
    instructions:
      "When given a broad goal or task, break it into numbered sub-tasks. For each sub-task specify: (1) what needs to be done in one clear sentence, (2) which agent or role should own it, (3) any dependencies on other sub-tasks, and (4) estimated effort (small/medium/large). Order sub-tasks by dependency and priority. Flag any sub-task that requires user approval before starting.",
    isRequired: false,
    assignTo: "main"
  },
  {
    name: "Escalation Handler",
    description:
      "Determines whether a situation requires escalation and drafts the appropriate escalation message.",
    category: "operations",
    instructions:
      "When evaluating a situation for escalation: (1) Check the agent's escalation rules to determine if this situation qualifies. (2) If escalation is needed, draft a clear escalation message that includes: WHAT happened, WHY it requires attention, URGENCY level (low/medium/high/critical), and RECOMMENDED ACTION. (3) If escalation is not needed, explain why and proceed normally. Never skip escalation for financial decisions, customer-facing communications, or irreversible actions.",
    isRequired: true,
    assignTo: "all"
  },
  {
    name: "Content Drafting",
    description:
      "Drafts content in the business's brand voice with proper structure, tone matching, and approval flagging.",
    category: "content",
    instructions:
      "When drafting any content: (1) Check the business's brand voice and knowledge base for tone guidance. (2) Structure the draft with a clear purpose statement, body, and call-to-action where appropriate. (3) Flag any claims, numbers, or promises that should be verified before publishing. (4) Present the draft clearly labeled as DRAFT — REQUIRES REVIEW. (5) Include a brief note on the intended audience and channel. Never publish or send content without explicit approval.",
    isRequired: false,
    assignTo: "specialist"
  },
  {
    name: "Knowledge Lookup",
    description:
      "Searches the business knowledge base before answering questions to ensure responses are grounded in approved information.",
    category: "system",
    instructions:
      "Before answering any question about the business, its products, pricing, policies, or processes: (1) Search the knowledge base for relevant entries. (2) If found, base your answer on the approved knowledge and cite which entry you referenced. (3) If not found, clearly state that the information is not in the knowledge base and either ask the user to add it or provide your best answer with a disclaimer that it should be verified. Never invent business facts.",
    isRequired: true,
    assignTo: "all"
  },
  {
    name: "Email Drafting",
    description:
      "Creates professional email drafts with proper formatting, tone matching, and subject line optimization.",
    category: "communication",
    instructions:
      "When drafting an email: (1) Write a compelling subject line under 60 characters. (2) Open with appropriate context — never start with 'I hope this finds you well' or similar filler. (3) Keep the body focused on one clear purpose. (4) End with a specific next step or call-to-action. (5) Match the formality level to the recipient relationship. (6) Flag the draft as DRAFT — REQUIRES REVIEW before sending. Include a brief note on the send timing recommendation if relevant.",
    isRequired: false,
    assignTo: "all"
  },
  {
    name: "Workflow Reporter",
    description:
      "Generates structured reports from workflow execution results with clear metrics and actionable insights.",
    category: "reporting",
    instructions:
      "When generating a report from workflow results: (1) Start with a one-sentence executive summary. (2) Present key metrics or outcomes in a scannable format. (3) Highlight anything unusual — both positive and negative. (4) End with 1-3 specific recommended next actions ordered by priority. (5) Keep the full report under 500 words unless the user requests more detail. Use plain English — no jargon.",
    isRequired: false,
    assignTo: "main"
  },
  {
    name: "Memory Writer",
    description:
      "Records important learnings, decisions, and outcomes to the agent's memory for future reference.",
    category: "system",
    instructions:
      "After completing a significant task, learning something new about the business, or receiving user feedback: (1) Identify the key learning or decision. (2) Write a concise memory entry with: DATE, CONTEXT (what was happening), LEARNING (what was discovered or decided), and IMPACT (how this should affect future behavior). (3) Categorize the memory as: business_fact, user_preference, process_learning, or mistake_to_avoid. Keep entries specific and actionable — vague entries are useless.",
    isRequired: false,
    assignTo: "all"
  },
  {
    name: "Approval Request",
    description:
      "Formats and submits structured approval requests with clear context, options, and recommended action.",
    category: "operations",
    instructions:
      "When requesting approval: (1) State clearly WHAT you want to do in one sentence. (2) Explain WHY this action is needed with brief context. (3) List any ALTERNATIVES considered and why this option is recommended. (4) Specify the IMPACT — what happens if approved and what happens if denied. (5) Note any TIME SENSITIVITY. (6) Present the request in a clear, skimmable format. Never proceed with the action before receiving explicit approval.",
    isRequired: true,
    assignTo: "all"
  }
];
