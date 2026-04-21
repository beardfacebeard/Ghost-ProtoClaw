# Ghost ProtoClaw — Premium Enhancement Roadmap

A deep-dive on what would take the app from "really good" to "Linear × Raycast × mission-control" premium. Written after a full codebase audit on 2026-04-21. The 2026 design system sweep is shipped — so this report intentionally skips surface design and focuses on structural product gaps.

---

## Ground Truth (Verified Against the Code)

Before the recommendations, a few things that are already better than you might think — and a few that are worse.

**What's already live:**
- Command palette (`components/admin/CommandPalette.tsx`) with ⌘K, search across pages/businesses/agents/workflows, styled with the new tokens.
- Activity feed polls every 5 seconds via `GET /api/admin/activity/stream` with a pause toggle — not true SSE but close enough for most eyes.
- Voice input in chat (`VoiceInputButton.tsx`) — Whisper-backed.
- Multi-user with `admin` / `super_admin` roles + per-business scoping (`businessIds[]` on `MissionControlAdminUser`).
- AuditEvent table captures actorEmail and diffs.
- ConfirmDialog with typed-name confirmation is already used for destructive actions.
- Sub-agent policy engine (`lib/sub-agent-policy.ts`) exists and gates child-agent spawning.
- Todos & Ideas capture — already has AI auto-assign (agent/tags/priority/dueDate) via `lib/llm/todo-auto-assign.ts`.

**What the audit confirmed is genuinely missing:**
- **Chat renders plain text only.** `MessageBubble.tsx:61` uses `whitespace-pre-wrap` — agent markdown (code blocks, tables, bold) comes through as literal asterisks. Every other serious chat app (Claude.ai, ChatGPT, Linear) renders markdown.
- No prompt version history on Agents — `updatedAt` only, no diff, no rollback.
- No eval framework — agent testing is one-message-at-a-time manual chat.
- No retrieval-source citations — the 3-tier KB retrieves, but users never see which items were injected into a response.
- No nightly digest — Master Agent exists as UI shell only; there's no scheduled run that produces "what happened overnight."
- No saved views / pinned dashboards — filters live only in URL params.
- No slash commands in chat.
- No exports (PDF / CSV / email digest).
- No optimistic UI updates — mutations round-trip before the UI moves.
- No demo business / sandbox — new users have to build from scratch to see the product work.

---

## The 14 Highest-Leverage Moves, Ranked

Ranking by: **gap size × user-visible impact × implementation cost**. Each entry includes what it is, why it matters, and a rough build estimate.

### Tier 1 — Experience Blockers (Ship first)

#### 1. Markdown rendering in chat
**Build:** 1 afternoon. Drop `react-markdown` + `remark-gfm` + `rehype-highlight` into `MessageBubble.tsx`. Tables, code blocks, inline code, headings, bold/italic, links. Keep the existing `prose` Tailwind typography plugin constraints so it doesn't explode the design system.
**Why:** This is the single biggest "the agent looks dumb" moment in the product right now. Agents DO produce markdown — the app just flattens it.
**Bonus:** Syntax-highlight code fences with the existing JetBrains Mono font for a native-editor feel.

#### 2. Citation / source provenance in chat
**Build:** 2–3 days. Every agent response currently ships with `toolCalls[]` metadata. Extend the `knowledge_lookup` tool result schema to return `{ id, title, score }` for retrieved KB items. Render them as inline pill links beneath the agent's message ("Sources: Pricing FAQ · Refund policy · Brand voice guide") that open the knowledge item in a side drawer.
**Why:** Perplexity popularized this and now every premium AI surface has it. For a non-technical user, seeing the agent's receipts is how you build trust.
**Bonus:** If two sources contradicted each other, flag it with `state-warning` tone. That's genuinely novel.

#### 3. Nightly digest from the Master Agent
**Build:** 1 day. Wire a scheduled workflow that runs the Master Agent at 6am user-local-time: `list_businesses` → for each, `ask_ceo_agent` with a fixed "summarize last 24h" prompt → compose a single digest → deliver via the workflow output channel (Telegram / email / in-app notification).
**Why:** The #1 job of a premium ops tool is telling you what matters before you ask. This converts the Master Agent from "thing I created once and forgot" to "the feature I open the app for." Also the cleanest Telegram value-add.
**Bonus:** Let each business override the digest prompt ("include revenue / skip KPIs / flag only anomalies") so it becomes a per-brand briefing.

#### 4. Slash commands in chat
**Build:** 2 days. In `MessageThread.tsx` / the chat composer, intercept text starting with `/` and open a cmdk-style popover. Commands: `/test <task>` (run against the agent's eval suite), `/approve` (approve the last pending request), `/schedule <cron>` (turn the current chat into a scheduled workflow), `/export` (export this conversation to markdown), `/memory <text>` (store the next message as a pinned memory), `/switch <agent>` (hand off to another agent mid-conversation).
**Why:** Raycast-tier feature. Gives power users a verb surface without leaving the keyboard. Chat stops being "just a chatbox" and becomes a command center.

#### 5. Optimistic updates across every mutation
**Build:** 3 days, gradual per page. Use a tiny `optimisticMutate` helper that updates local state immediately, fires the request, and rolls back on error with a toast. Priority order: approve/reject in Approvals, tier changes in Memory, enable/disable in Knowledge, promote-to-active in Todos, enable toggle on Workflows.
**Why:** The perceived speed difference between "click → spinner → result" and "click → instant → reconciled" is what separates premium from merely fast.

---

### Tier 2 — Raycast / Linear Parity

#### 6. Global keyboard shortcut system
**Build:** 2–3 days. Introduce a `useKeyboardShortcut` hook + a `/admin/help/shortcuts` page (⌘K-discoverable as well). Minimum set: `j`/`k` up/down in any list, `Enter` to open, `A` approve / `R` reject on Approvals, `E` edit, `⌘+Enter` submit in any text form, `G then A` go-to Agents, `G then D` dashboard, `⌘⇧K` focus the inbox, `?` show shortcuts overlay.
**Why:** This is the feature that makes people say "it feels like Linear." Once you have five of them memorized, you stop using the mouse in the app.

#### 7. Agent prompt version history + rollback
**Build:** 2 days. Add a `AgentPromptRevision` table keyed to `agentId` with snapshots of `systemPrompt`, `roleInstructions`, `outputStyle`, `constraints`, `escalationRules`, `askBeforeDoing` + a diff timestamp and actor. Hook into `updateAgent` so every save writes a revision. New tab on Agent detail: "History" — timeline of diffs with one-click rollback.
**Why:** People will experiment harder on prompts if there's a safety net. Right now every edit is one-way.

#### 8. Agent evals
**Build:** 5–7 days. New page `/admin/agents/[id]/evals`. Users write test cases: `{ input, expected_behavior, assertion }`. Running an eval suite fires the agent against each test in parallel, grades with a judge model, returns pass/fail + diff. Save suites. Re-run on prompt changes automatically. Badge the Agent card with "Suite: 12/14 passing."
**Why:** This is the honest way to edit prompts for a business. Without evals, you edit blindly and hope.

#### 9. Saved views + pinned dashboard widgets
**Build:** 3 days. Add a `SavedView` table (`userId, pageKey, filters JSON, name, pinned bool`). On any list page with filters (Approvals, Activity, Costs, Workflows, Issues, Todos), "Save this view" button → appears in sidebar under page name. Dashboard page lets user pin up to 8 widgets (each widget = the result of a saved view, rendered compactly).
**Why:** Operators don't want to re-filter every morning. They want the same four views every day, in the same order.

#### 10. Real retrieve-and-notify notification center
**Build:** 3 days. New `NotificationEntry` table + bell icon in TopBar with unread count. Emitters: approval request created, workflow failed, budget ≥ 80%, YouTube quota ≥ 80%, new outreach target, new todo via Telegram, OAuth token expiring within 7 days. Click bell → dropdown list, click item → navigate + mark read. Sticky 30-day history on a dedicated `/admin/inbox/system` page.
**Why:** Right now the signal lives in Health + Today + Approvals badges that you have to visit. This centralizes every "hey you should know" in one bell.
**Bonus:** Subscribe any notification type to email / Telegram / desktop with one toggle.

---

### Tier 3 — Revenue Multipliers (Premium upsell)

#### 11. Simulation mode for workflows
**Build:** 5 days. Workflow detail gets a "Dry run" button next to "Run now." Dry run uses the same agent + tools but swaps any side-effect tool (`send_email`, `youtube_upload_video`, `reddit_post`, `stripe_*`) with mock implementations that log the intended call and return a synthetic success response. Result is a "this is what would have happened" trace you can read through with zero blast radius.
**Why:** Non-technical users are terrified of turning on automation because they can't tell what a workflow will actually do. Dry run eliminates the fear. Competitors (Zapier, n8n) don't have this.

#### 12. Explain-this-run
**Build:** 2 days. For any `ActionRun`, a button "Explain this run" — sends the run's full trace (tools called, KB retrieved, memories touched, outputs produced, cost incurred) to a cheap model with a prompt like "explain in plain English what this agent did and why, in 4 bullets." Render below the raw JSON on the run detail.
**Why:** Raw JSON is the same problem as plain-text chat — looks dumb to non-technical operators. An explanation layer makes every run legible.

#### 13. Business-outcome linkage on Goals
**Build:** 5 days. Goal entry gets a new optional `metricSource` field with choices: `stripe_mrr`, `youtube_subscribers`, `reddit_post_count`, `workflow_completion_rate`, `custom_webhook`. Progress auto-updates from the source at a daily cadence. Show a sparkline + "on pace / ahead / behind" indicator.
**Why:** A Goal that doesn't auto-track its own progress is just a note. A Goal tied to live revenue or real output numbers is an operating target.

#### 14. Natural-language system query
**Build:** 3–4 days. A single input at `/admin/query` (or a ⌘K modifier: `⌘K ?`). User types "how many approvals did I reject last week" or "which workflow costs the most per run." A Claude-backed layer translates into a Prisma query against the existing tables (scoped to the user's org), executes, returns a natural-language answer + the supporting rows. Safe: read-only; query plan is shown before execute for destructive-looking patterns.
**Why:** This is the most AI-native feature competitors haven't shipped. It also replaces half the "export to CSV" requests because you can just ask.

---

## Outside-the-Box Ideas

These go beyond the audit. None are competitor features — they're Ghost-ProtoClaw-native moves.

### A. Replay an agent run with a changed prompt
Take any completed run. Show a "What if I had…" button. User edits the agent's system prompt inline. Clicks "Replay." The exact same input + tool calls are re-run against the new prompt. Side-by-side diff of the response. This is the ultimate evals-meets-time-travel feature and nobody in the agent-ops space has it.

### B. Auto-generated business runbook
Click "Generate runbook" on any business. A scheduled workflow composes a PDF (or printable HTML) containing: every agent's role + system prompt summary, every workflow's schedule + trigger + output, every knowledge item title grouped by category, the current integration map, the sub-agent policy, cost trend over the last 30 days. Re-generatable on demand. Great for: handing off to a partner, onboarding a new team member, or showing a client what they're paying for.

### C. Agent "dream journal"
A per-agent view that surfaces: the memories it's formed this week, the mistakes it's flagged in `learn_from_outcome`, the KB items it's referenced most often, the other agents it's asked for help. Reads like a diary. Makes the agent feel alive and gives the operator a window into whether the agent is healthy or drifting.

### D. The "5pm wrap" button
One button on Today that runs: a Master Agent summary of the day, auto-snoozes anything unactioned that's low-priority, posts unread approvals to Telegram so you can triage from your phone, and composes a morning-prep memo that lands in your inbox by 6am. It's a quitting-time ritual that makes the next day start faster.

### E. Cost-weighted model router
On every agent, a small switch: "Route to the cheapest model that passes your evals." The system runs the agent's eval suite against every available model monthly, picks the cheapest that hits ≥ 95% pass rate, and routes new calls there. Falls back to a higher-tier model if any eval in the suite fails mid-month. This is the single highest-leverage cost-saving feature you could ship — and it's impossible without evals (#8).

### F. Agent calendar view
Today has a list. A calendar view that shows scheduled workflows, deadline-bound todos, approval expiries, and YouTube uploads as blocks on a week/month grid — with each block tinted by the agent's emoji color — would make the "I run a company of AIs" narrative visual in a way no competitor has nailed.

### G. One-click retry-with-a-better-model
When a workflow or action run fails, the error toast includes "Retry with Sonnet" (if it ran on Haiku) or "Retry with Opus 4.7" (if it ran on Sonnet). One click re-runs the exact same invocation on a more capable model. Costs more, but the moment you need it, you really need it.

### H. "Show me what I configured" audio briefing
Once a week, the system generates a 3–5 minute ElevenLabs voiceover (you already have the integration!) summarizing what changed in your setup: new agents, edited prompts, workflows you enabled, goals you hit. Delivered as a Telegram voice note. This is the kind of tiny, unexpected, premium touch that becomes "the feature I tell people about."

### I. Knowledge base health grade
Every knowledge item gets a weekly score: `freshness` (last updated), `usage` (how often agents retrieve it), `contradictions` (how often it contradicts other items in retrieved context). Items scoring low show up in a "Needs attention" queue on the Knowledge page. Turns KB hygiene from an invisible chore into a scoreboard.

### J. Claudius — a tutorial agent that lives in the app
A dedicated "concierge" agent that can see the admin surface state. First-run experience: "Claudius here. Want me to walk you through creating your first business? I'll point at each thing as you go." Uses the app's own agent framework — so you dogfood the platform while teaching it. Disable after 5 uses.

---

## Recommended Sequencing

If I were shipping this, here's the order — each tier is ~2 weeks of focused work:

**Sprint 1 — "It looks like a premium chat tool" (week 1–2)**
1. Markdown rendering in chat (#1)
2. Citation / source provenance (#2)
3. Slash commands (#4)
4. Optimistic updates (#5)

**Sprint 2 — "It feels like a mission control" (week 3–4)**
5. Global keyboard shortcuts (#6)
6. Notification center (#10)
7. Nightly digest from Master Agent (#3)
8. Saved views + pinned dashboard (#9)

**Sprint 3 — "I trust it more than a human" (week 5–6)**
9. Agent prompt version history (#7)
10. Agent evals (#8)
11. Simulation mode (#11)
12. Explain-this-run (#12)

**Sprint 4 — "This is the future of ops" (week 7–8)**
13. Business-outcome linkage (#13)
14. Natural-language system query (#14)
15. Pick two outside-the-box ideas (A–J) to ship as the "wow" moments

---

## The Single Highest-ROI Move

If I could ship only one thing this quarter, it would be **Markdown rendering + Citation provenance + Slash commands** shipped together (#1, #2, #4). That combination takes the chat experience from "has AI in it" to "feels like the place I want to do this work." Every other improvement on the list gets more ROI after that because the product is now believable in a demo.

The second-most-impactful move is **Agent evals + Prompt version history** (#7, #8). Those two turn agent authoring from "pray and edit" into "science" — and they unlock everything else in sprint 4.

---

*Generated after a thorough audit of the Ghost ProtoClaw codebase, verified against current files and Prisma schema.*
