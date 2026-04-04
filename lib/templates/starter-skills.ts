/**
 * Starter Skills
 *
 * Universal skills that are automatically created and assigned to agents
 * when a business is created from a template. Adapted from real-world
 * agent skill patterns — stripped of any external branding.
 *
 * Role-specific skill sets are exported for Phase 1 templates:
 * CEO_SKILLS, COO_SKILLS, CTO_SKILLS, CMO_SKILLS, CFO_SKILLS,
 * SALES_SKILLS, SUPPORT_SKILLS.
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

// ---------------------------------------------------------------------------
// UNIVERSAL SKILLS (10 core skills assigned to every business)
// ---------------------------------------------------------------------------

export const STARTER_SKILLS: StarterSkillTemplate[] = [
  {
    name: "Heartbeat Check",
    description:
      "Periodic self-check that confirms the agent is active, responsive, and aligned with its current objectives.",
    category: "system",
    instructions:
      "When triggered, confirm you are operational by summarizing: (1) your current role and purpose, (2) the last task you completed or are working on, (3) any blockers or pending approvals, and (4) your top priority for the next cycle. Keep the response under 200 words. If you have no pending work, say so clearly and suggest a proactive action you could take.",
    isRequired: true,
    assignTo: "all",
  },
  {
    name: "Daily Summary",
    description:
      "Generates a concise end-of-day summary of completed tasks, pending items, and recommended next actions.",
    category: "reporting",
    instructions:
      "Produce a structured daily summary with these sections: COMPLETED (what was finished today with outcomes), PENDING (what is still in progress or waiting on approval), BLOCKED (anything you cannot proceed on and why), and NEXT (the top 3 recommended actions for tomorrow ordered by priority). Use bullet points, keep each item to one sentence, and highlight anything that needs the user's attention with a ⚠️ prefix.",
    isRequired: false,
    assignTo: "all",
  },
  {
    name: "Task Breakdown",
    description:
      "Breaks a high-level goal or request into specific, actionable sub-tasks with clear ownership and sequencing.",
    category: "operations",
    instructions:
      "When given a broad goal or task, break it into numbered sub-tasks. For each sub-task specify: (1) what needs to be done in one clear sentence, (2) which agent or role should own it, (3) any dependencies on other sub-tasks, and (4) estimated effort (small/medium/large). Order sub-tasks by dependency and priority. Flag any sub-task that requires user approval before starting. If the total scope exceeds what can be done in one cycle, recommend a phased approach.",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Escalation Handler",
    description:
      "Determines whether a situation requires escalation and drafts the appropriate escalation message.",
    category: "operations",
    instructions:
      "When evaluating a situation for escalation: (1) Check the agent's escalation rules to determine if this situation qualifies. (2) If escalation is needed, draft a clear escalation message that includes: WHAT happened, WHY it requires attention, URGENCY level (low/medium/high/critical), and RECOMMENDED ACTION. (3) If escalation is not needed, explain why and proceed normally. Never skip escalation for financial decisions, customer-facing communications, or irreversible actions. Always include a proposed resolution alongside the escalation.",
    isRequired: true,
    assignTo: "all",
  },
  {
    name: "Content Drafting",
    description:
      "Drafts content in the business's brand voice with proper structure, tone matching, and approval flagging.",
    category: "content",
    instructions:
      "When drafting any content: (1) Check the business's brand voice and knowledge base for tone guidance. (2) Structure the draft with a clear purpose statement, body, and call-to-action where appropriate. (3) Flag any claims, numbers, or promises that should be verified before publishing. (4) Present the draft clearly labeled as DRAFT — REQUIRES REVIEW. (5) Include a brief note on the intended audience, channel, and optimal posting time if applicable. Never publish or send content without explicit approval.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Knowledge Lookup",
    description:
      "Searches the business knowledge base before answering questions to ensure responses are grounded in approved information.",
    category: "system",
    instructions:
      "Before answering any question about the business, its products, pricing, policies, or processes: (1) Search the knowledge base for relevant entries. (2) If found, base your answer on the approved knowledge and cite which entry you referenced. (3) If not found, clearly state that the information is not in the knowledge base and either ask the user to add it or provide your best answer with a disclaimer that it should be verified. Never invent business facts. If multiple entries conflict, flag the discrepancy to the user.",
    isRequired: true,
    assignTo: "all",
  },
  {
    name: "Email Drafting",
    description:
      "Creates professional email drafts with proper formatting, tone matching, and subject line optimization.",
    category: "communication",
    instructions:
      "When drafting an email: (1) Write a compelling subject line under 60 characters. (2) Open with appropriate context — never start with 'I hope this finds you well' or similar filler. (3) Keep the body focused on one clear purpose with short paragraphs. (4) End with a specific next step or call-to-action. (5) Match the formality level to the recipient relationship. (6) Flag the draft as DRAFT — REQUIRES REVIEW before sending. Include a brief note on the send timing recommendation if relevant.",
    isRequired: false,
    assignTo: "all",
  },
  {
    name: "Workflow Reporter",
    description:
      "Generates structured reports from workflow execution results with clear metrics and actionable insights.",
    category: "reporting",
    instructions:
      "When generating a report from workflow results: (1) Start with a one-sentence executive summary. (2) Present key metrics or outcomes in a scannable format using tables or bullet points. (3) Highlight anything unusual — both positive and negative. (4) Compare results against previous runs or benchmarks when available. (5) End with 1-3 specific recommended next actions ordered by priority. Keep the full report under 500 words unless the user requests more detail. Use plain English — no jargon.",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Memory Writer",
    description:
      "Records important learnings, decisions, and outcomes to the agent's memory for future reference.",
    category: "system",
    instructions:
      "After completing a significant task, learning something new about the business, or receiving user feedback: (1) Identify the key learning or decision. (2) Write a concise memory entry with: DATE, CONTEXT (what was happening), LEARNING (what was discovered or decided), and IMPACT (how this should affect future behavior). (3) Categorize the memory as: business_fact, user_preference, process_learning, or mistake_to_avoid. Keep entries specific and actionable — vague entries are useless. Review existing memories to avoid duplicates.",
    isRequired: false,
    assignTo: "all",
  },
  {
    name: "Approval Request",
    description:
      "Formats and submits structured approval requests with clear context, options, and recommended action.",
    category: "operations",
    instructions:
      "When requesting approval: (1) State clearly WHAT you want to do in one sentence. (2) Explain WHY this action is needed with brief context. (3) List any ALTERNATIVES considered and why this option is recommended. (4) Specify the IMPACT — what happens if approved and what happens if denied. (5) Note any TIME SENSITIVITY with a specific deadline if applicable. (6) Present the request in a clear, skimmable format. Never proceed with the action before receiving explicit approval.",
    isRequired: true,
    assignTo: "all",
  },
];

// ---------------------------------------------------------------------------
// CEO / EXECUTIVE SKILLS
// ---------------------------------------------------------------------------

export const CEO_SKILLS: StarterSkillTemplate[] = [
  {
    name: "Strategic Decision Matrix",
    description:
      "Creates a weighted decision matrix to evaluate options across multiple criteria with a clear recommendation.",
    category: "strategy",
    instructions:
      "When presented with a decision that has multiple options, create a structured decision matrix. List each option as a row, define 4-6 evaluation criteria as columns (e.g., cost, time-to-value, risk, alignment with goals, scalability, reversibility). Score each criterion 1-5 and calculate weighted totals. Present the recommendation with a clear rationale. Always flag decisions that are irreversible or high-cost for human approval.",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Business Model Validator",
    description:
      "Evaluates a business model or revenue idea across five critical dimensions with a viability score.",
    category: "strategy",
    instructions:
      "Evaluate a business model or revenue idea by analyzing: (1) target customer segment and their acute pain point, (2) unique value proposition vs alternatives, (3) revenue model and pricing logic, (4) cost structure and unit economics, (5) key risks and assumptions. Score viability 1-10 with specific reasoning. Flag any assumption that hasn't been validated with real data.",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Partnership Evaluator",
    description:
      "Assesses potential partnerships or collaborations with a structured GO/NO-GO recommendation.",
    category: "operations",
    instructions:
      "When evaluating a potential partnership or collaboration, assess: (1) strategic alignment with business goals, (2) what each party brings to the table, (3) revenue/value sharing model, (4) risks and exit clauses needed, (5) resource commitment required, (6) timeline and milestones. Provide a GO/NO-GO recommendation with conditions.",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Quarterly OKR Builder",
    description:
      "Creates quarterly OKRs with measurable key results, ownership assignment, and dependency mapping.",
    category: "strategy",
    instructions:
      "Create quarterly OKRs (Objectives and Key Results) by: (1) reviewing current business performance and gaps, (2) defining 3-5 objectives that are ambitious but achievable, (3) for each objective define 3-4 measurable key results with specific targets, (4) assign ownership to agents/roles, (5) identify dependencies and blockers. Format as a clean, trackable document.",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Risk Assessor",
    description:
      "Analyzes potential risks for any business decision, categorized by type with mitigation strategies.",
    category: "analysis",
    instructions:
      "Analyze potential risks for any business decision or initiative. Categorize risks as: Financial, Operational, Reputational, Legal, or Technical. For each risk: describe the scenario, estimate probability (Low/Medium/High), estimate impact (Low/Medium/High), and propose a mitigation strategy. Prioritize by risk score (probability × impact).",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Board Report Generator",
    description:
      "Generates a comprehensive, data-driven business report suitable for board or executive review.",
    category: "reporting",
    instructions:
      "Generate a comprehensive business report covering: Executive Summary (3-5 bullet key highlights), Financial Overview (revenue, costs, margins, cash position), Operational Metrics (key KPIs and trends), Strategic Progress (goals status, milestones hit), Risks & Issues (top 3 with mitigation), and Next Quarter Outlook. Keep professional, data-driven, and under 2 pages.",
    isRequired: false,
    assignTo: "main",
  },
];

// ---------------------------------------------------------------------------
// COO / OPERATIONS SKILLS
// ---------------------------------------------------------------------------

export const COO_SKILLS: StarterSkillTemplate[] = [
  {
    name: "Process Automation Identifier",
    description:
      "Audits business processes to identify automation opportunities prioritized by ROI.",
    category: "operations",
    instructions:
      "Audit current business processes and identify automation opportunities. For each process: describe current manual steps, estimate time spent per week, assess automation feasibility (Easy/Medium/Hard), recommend specific tools or workflows, and calculate estimated time savings. Prioritize by ROI (time saved vs implementation effort).",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "SOP Generator",
    description:
      "Creates Standard Operating Procedure documents that are clear enough for a new team member to follow.",
    category: "operations",
    instructions:
      "Create a Standard Operating Procedure document for any business process. Include: Purpose and scope, roles responsible, step-by-step instructions with decision points, quality checkpoints, common errors and how to avoid them, escalation procedures, and version/review date. Write clearly enough that a new team member could follow it.",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Operations Bottleneck Finder",
    description:
      "Analyzes workflow data to identify bottlenecks with root cause analysis and fix recommendations.",
    category: "analysis",
    instructions:
      "Analyze workflow and process data to identify bottlenecks. Look for: tasks that consistently take longer than expected, handoff points where work stalls, resource constraints causing delays, approval steps creating queues, and dependency chains. For each bottleneck provide the root cause and a specific fix recommendation.",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Team Performance Dashboard",
    description:
      "Compiles agent/team performance metrics with workload distribution and trend analysis.",
    category: "reporting",
    instructions:
      "Compile a team/agent performance summary covering: tasks completed vs assigned, average completion time, quality metrics (rework rate, approval rate), workload distribution, and trending patterns. Flag any agent that is overloaded, underutilized, or showing declining performance. Present in a clean dashboard format.",
    isRequired: false,
    assignTo: "main",
  },
  {
    name: "Cross-Team Dependency Mapper",
    description:
      "Maps dependencies between agents, teams, and workflows to reduce coupling and improve parallel execution.",
    category: "operations",
    instructions:
      "Map dependencies between agents, teams, and workflows. Identify: which outputs feed into which inputs, critical path items where delays cascade, single points of failure, and circular dependencies. Recommend ways to reduce coupling and improve parallel execution.",
    isRequired: false,
    assignTo: "main",
  },
];

// ---------------------------------------------------------------------------
// CTO / TECH SKILLS
// ---------------------------------------------------------------------------

export const CTO_SKILLS: StarterSkillTemplate[] = [
  {
    name: "Architecture Decision Recorder",
    description:
      "Documents technical decisions using the ADR format with context, options, and trade-offs.",
    category: "technical",
    instructions:
      "Document technical decisions using the ADR (Architecture Decision Record) format: Title, Status, Context (why this decision is needed), Options Considered (at least 3), Decision (which option and why), Consequences (trade-offs accepted). Keep technical but accessible to non-engineers.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Tech Debt Prioritizer",
    description:
      "Catalogs and prioritizes technical debt items by impact-to-effort ratio with timeline recommendations.",
    category: "technical",
    instructions:
      "Catalog and prioritize technical debt items. For each item: describe the debt, explain the business impact if not addressed, estimate effort to fix (hours/days), assess urgency (critical path vs nice-to-have), and recommend a timeline. Sort by impact-to-effort ratio. Group into 'fix now', 'fix this quarter', and 'monitor'.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Build vs Buy Analyzer",
    description:
      "Analyzes whether to build in-house or buy an existing tool across six evaluation dimensions.",
    category: "analysis",
    instructions:
      "When evaluating whether to build a solution in-house or buy/use an existing tool, analyze: (1) total cost of ownership for both options over 12 months, (2) time to value, (3) customization needs, (4) maintenance burden, (5) vendor lock-in risk, (6) team capability fit. Provide a clear recommendation with reasoning.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Security Audit Checklist",
    description:
      "Runs through a comprehensive security checklist and flags critical gaps in any system or process.",
    category: "compliance",
    instructions:
      "Run through a security checklist for any system or process: authentication/authorization review, data encryption at rest and in transit, API key management, access control audit, backup verification, dependency vulnerability scan, logging and monitoring coverage, incident response plan status. Flag any critical gaps.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "API Integration Planner",
    description:
      "Plans API integrations with full documentation of endpoints, error handling, and rollback procedures.",
    category: "technical",
    instructions:
      "Plan an API integration by documenting: endpoints needed, authentication method, rate limits and quotas, data mapping (source fields to destination), error handling strategy, retry logic, monitoring/alerting plan, and rollback procedure. Include a timeline with milestones.",
    isRequired: false,
    assignTo: "specialist",
  },
];

// ---------------------------------------------------------------------------
// CMO / MARKETING SKILLS
// ---------------------------------------------------------------------------

export const CMO_SKILLS: StarterSkillTemplate[] = [
  {
    name: "Campaign ROI Calculator",
    description:
      "Calculates marketing campaign ROI with channel benchmarks and scale/optimize/cut recommendations.",
    category: "analysis",
    instructions:
      "Calculate marketing campaign ROI by tracking: total spend (ads + tools + time), impressions/reach, clicks/engagement, leads generated, conversions, revenue attributed, and final ROI percentage. Compare against benchmarks for the channel. Recommend whether to scale, optimize, or cut the campaign.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Content Repurposer",
    description:
      "Takes a single piece of content and generates a multi-platform repurposing plan with hooks and formats.",
    category: "content",
    instructions:
      "Take a single piece of content (blog post, video, podcast) and generate a repurposing plan: extract 5-10 key quotes/snippets for social media, outline a newsletter version, create a thread/carousel structure, identify infographic opportunities, suggest video clip cuts. For each derivative, specify the platform, format, and hook.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Funnel Analyzer",
    description:
      "Analyzes marketing/sales funnel stage by stage with conversion rates, drop-off reasons, and optimizations.",
    category: "analysis",
    instructions:
      "Analyze a marketing/sales funnel stage by stage. For each stage: current conversion rate, benchmark comparison, drop-off volume, likely reasons for drop-off, and specific optimization recommendations. Calculate overall funnel efficiency and revenue impact of improving each stage by 10%.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "A/B Test Designer",
    description:
      "Designs statistically sound A/B tests with hypothesis, sample size, success metrics, and decision criteria.",
    category: "operations",
    instructions:
      "Design an A/B test for any marketing element: define the hypothesis, specify the variable being tested, determine sample size needed for statistical significance, set the success metric, define the test duration, and outline the decision criteria. Include what to do with winning and losing variants.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Brand Consistency Checker",
    description:
      "Reviews content against brand guidelines and flags deviations with suggested corrections.",
    category: "compliance",
    instructions:
      "Review content or messaging against brand guidelines. Check: tone of voice alignment, visual identity consistency, messaging hierarchy, value proposition clarity, competitor differentiation, and call-to-action effectiveness. Flag any deviations and suggest corrections.",
    isRequired: false,
    assignTo: "specialist",
  },
];

// ---------------------------------------------------------------------------
// CFO / FINANCE SKILLS
// ---------------------------------------------------------------------------

export const CFO_SKILLS: StarterSkillTemplate[] = [
  {
    name: "Cash Flow Projector",
    description:
      "Projects cash flow for 30/60/90 days with probability-weighted revenue and safety threshold alerts.",
    category: "analysis",
    instructions:
      "Project cash flow for the next 30/60/90 days based on: known recurring revenue, expected new sales (with probability weighting), upcoming expenses (fixed and variable), one-time costs, and payment timing. Flag any periods where cash balance drops below safety threshold. Recommend actions to improve cash position.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Budget Variance Analyzer",
    description:
      "Compares actual spending against budget by category with variance explanations and adjustment recommendations.",
    category: "reporting",
    instructions:
      "Compare actual spending against budget by category. For each line item: budgeted amount, actual amount, variance ($ and %), and explanation for significant variances (>10%). Highlight areas of overspend and underspend. Recommend budget adjustments for next period.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Pricing Model Tester",
    description:
      "Models pricing strategies across multiple scenarios with volume impact and competitive positioning analysis.",
    category: "strategy",
    instructions:
      "Evaluate pricing strategies by modeling: current pricing and revenue, proposed pricing change, estimated volume impact, net revenue effect, competitive positioning impact, and customer segment sensitivity. Run scenarios for 3 price points and recommend the optimal option.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Financial Health Scorecard",
    description:
      "Generates a financial health scorecard with key metrics scored green/yellow/red against industry benchmarks.",
    category: "reporting",
    instructions:
      "Generate a financial health scorecard covering: revenue growth rate, gross margin, net margin, burn rate (if applicable), customer acquisition cost, lifetime value, LTV:CAC ratio, monthly recurring revenue, churn rate, and runway. Score each metric green/yellow/red against industry benchmarks.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Invoice Tracker",
    description:
      "Tracks outstanding invoices and receivables with aging buckets and automated follow-up draft messages.",
    category: "operations",
    instructions:
      "Track outstanding invoices and receivables: list all pending invoices with client, amount, due date, and days outstanding. Categorize as current, 30-day, 60-day, 90-day+. Calculate total AR and average days to payment. Draft follow-up messages for overdue invoices prioritized by amount.",
    isRequired: false,
    assignTo: "specialist",
  },
];

// ---------------------------------------------------------------------------
// SALES SKILLS
// ---------------------------------------------------------------------------

export const SALES_SKILLS: StarterSkillTemplate[] = [
  {
    name: "Lead Scorer",
    description:
      "Scores incoming leads 1-100 based on budget, urgency, timeline, fit, and engagement with category recommendations.",
    category: "analysis",
    instructions:
      "Score incoming leads on a 1-100 scale based on: budget authority (can they pay?), need urgency (how acute is the pain?), timeline (when do they want to start?), fit (do they match our ideal customer?), and engagement level (how responsive are they?). Categorize as Hot (80+), Warm (50-79), or Cold (<50). Recommend next action for each category.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Discovery Call Prep",
    description:
      "Prepares a one-page brief for sales calls with prospect research, discovery questions, and objection handling.",
    category: "operations",
    instructions:
      "Prepare for a sales call by compiling: prospect company research (size, industry, recent news), key stakeholders and their likely priorities, 5 discovery questions to uncover pain points, potential objections and responses, relevant case studies or proof points, and a proposed next step. Format as a one-page brief.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Proposal Drafter",
    description:
      "Drafts client proposals with executive summary, scope, pricing, and terms matched to the prospect's industry.",
    category: "content",
    instructions:
      "Draft a client proposal with: executive summary of their problem and our solution, scope of work with deliverables and timeline, pricing with clear value justification, terms and conditions, team/credentials overview, and next steps. Match tone to the prospect's industry and formality level.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Objection Handler",
    description:
      "Responds to sales objections using the feel-felt-found framework with supporting data points.",
    category: "operations",
    instructions:
      "When a sales objection is raised, respond with the feel-felt-found framework: acknowledge the concern empathetically, share that others have felt similarly, explain what they found after moving forward. Provide specific data points or case studies to support. Never be pushy — focus on helping them make the right decision.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Follow-Up Sequencer",
    description:
      "Designs multi-touchpoint follow-up sequences that provide value at each step and adapt to engagement signals.",
    category: "operations",
    instructions:
      "Design a follow-up sequence for a prospect: Day 1 (value-add touchpoint), Day 3 (social proof/case study), Day 7 (direct question about timeline), Day 14 (new insight or resource), Day 30 (breakup email that leaves door open). Each touchpoint should provide value, not just ask for a meeting. Adapt based on engagement signals.",
    isRequired: false,
    assignTo: "specialist",
  },
];

// ---------------------------------------------------------------------------
// SUPPORT / SERVICE SKILLS
// ---------------------------------------------------------------------------

export const SUPPORT_SKILLS: StarterSkillTemplate[] = [
  {
    name: "Client Onboarding Checklist",
    description:
      "Creates a tailored client onboarding checklist with milestones, communication setup, and success criteria.",
    category: "operations",
    instructions:
      "Create a client onboarding checklist tailored to the service: welcome message with expectations, access/credentials setup, kickoff meeting agenda, initial data/info gathering, first milestone definition, communication channel setup, and success criteria alignment. Track completion percentage.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Feedback Collector",
    description:
      "Designs and executes feedback collection with targeted questions, optimal timing, and actionable insights.",
    category: "operations",
    instructions:
      "Design and execute a feedback collection process: craft 3-5 targeted questions (mix of rating scales and open-ended), determine optimal timing (post-delivery, monthly, quarterly), compile responses into actionable insights, identify patterns and trends, and generate a summary with recommended improvements.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Escalation Protocol",
    description:
      "Handles escalations with severity assessment, resolution tracking, and post-mortem process updates.",
    category: "compliance",
    instructions:
      "When handling an escalation: (1) acknowledge the issue immediately with empathy, (2) document the problem clearly with timeline, (3) assess severity (P1-critical, P2-high, P3-medium, P4-low), (4) assign to appropriate resolver, (5) set and communicate resolution timeline, (6) follow up until resolved, (7) conduct post-mortem and update processes.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "Client Health Monitor",
    description:
      "Assesses client health across five dimensions with churn risk flagging and retention action plans.",
    category: "analysis",
    instructions:
      "Assess client health by scoring: engagement frequency (are they using our service?), satisfaction signals (feedback, NPS, complaints), payment status (on-time, late, disputed), growth trajectory (expanding scope or contracting?), and relationship strength (do they refer us?). Flag any client at risk of churning with a retention action plan.",
    isRequired: false,
    assignTo: "specialist",
  },
  {
    name: "FAQ Builder",
    description:
      "Compiles and maintains a searchable FAQ from common inquiries with gap identification and monthly updates.",
    category: "knowledge",
    instructions:
      "Compile frequently asked questions by: gathering common inquiries from conversations, categorizing by topic, writing clear concise answers, linking to relevant resources, and identifying gaps where new content or processes are needed. Format for easy searchability. Update monthly based on new questions.",
    isRequired: false,
    assignTo: "specialist",
  },
];
