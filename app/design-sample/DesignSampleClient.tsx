"use client";

import { useState, useEffect } from "react";

// ── Type helpers ────────────────────────────────────────────────────────

type FontSpec = {
  id: "inter" | "geist" | "satoshi";
  name: string;
  family: string;
  blurb: string;
  headlineFamily?: string;
};

type AccentSpec = {
  id: "cool" | "classic" | "warm";
  name: string;
  hex: string;
  bright: string;
  deep: string;
  blurb: string;
};

type StyleSpec = {
  id: "quiet" | "cinematic" | "hybrid";
  name: string;
  blurb: string;
  examples: string;
};

// ── Design tokens (shared across samples) ──────────────────────────────

const TOKENS = {
  bgApp: "#08090B",
  bgSurface: "#101217",
  bgSurface2: "#161922",
  bgSurface3: "#1E2230",
  borderSubtle: "#1F232C",
  border: "#2A2F3A",
  borderStrong: "#3A4150",
  textPrimary: "#F2F4F8",
  textSecondary: "#8B93A3",
  textMuted: "#5C6475"
};

const FONTS: FontSpec[] = [
  {
    id: "inter",
    name: "Inter",
    family: "'Inter', system-ui, sans-serif",
    blurb:
      "The industry standard. Used by Figma, GitHub, Vercel dashboard. Invisible and legible — it signals 'modern tech' without saying anything.",
    headlineFamily: "'Inter', system-ui, sans-serif"
  },
  {
    id: "geist",
    name: "Geist",
    family: "'Geist', 'Inter', system-ui, sans-serif",
    blurb:
      "Vercel's house font. Built for developer tools. Slightly more geometric than Inter. A tech brand that wants to feel like it designed its own font.",
    headlineFamily: "'Geist', 'Inter', system-ui, sans-serif"
  },
  {
    id: "satoshi",
    name: "Satoshi",
    family: "'Satoshi', 'Inter', system-ui, sans-serif",
    blurb:
      "Sharper and more editorial. Feels premium in white-on-black. A little more character than Inter — good for brands that want to be felt, not just read.",
    headlineFamily: "'Clash Grotesk', 'Satoshi', sans-serif"
  }
];

const ACCENTS: AccentSpec[] = [
  {
    id: "cool",
    name: "Cool Steel",
    hex: "#4A6FA5",
    bright: "#6D93C9",
    deep: "#2F4F7A",
    blurb:
      "More blue, less warm. Reads 'engineering tool' — think Linear, Arc browser. Most serious."
  },
  {
    id: "classic",
    name: "Classic Steel",
    hex: "#5B7FB0",
    bright: "#7FA1D1",
    deep: "#3B5F8F",
    blurb:
      "Balanced — blue with enough warmth to feel human. My recommendation. Reads as 'premium SaaS with soul.'"
  },
  {
    id: "warm",
    name: "Warm Steel",
    hex: "#6B82B5",
    bright: "#8FA4D0",
    deep: "#4B608F",
    blurb:
      "Slight violet tint. Softer, more approachable. Reads closer to 'design tool' — think Notion, Things 3."
  }
];

const STYLES: StyleSpec[] = [
  {
    id: "quiet",
    name: "Quiet Luxury",
    blurb:
      "Linear. Mercury. Things 3. Perfect spacing, 1px borders, understated. Trust-heavy. Invisible interface.",
    examples: "Linear · Mercury · Things 3"
  },
  {
    id: "cinematic",
    name: "Cinematic Dark",
    blurb:
      "Raycast. Cron. Portal. Deep blacks with glowing accents, glassmorphism, micro-interactions. Feels like the future.",
    examples: "Raycast · Cron · Portal"
  },
  {
    id: "hybrid",
    name: "Hybrid (my pick)",
    blurb:
      "Quiet Luxury as the base (90% of screens), Cinematic Dark reserved for AI-feeling moments. The recommended direction.",
    examples: "Linear + Raycast touches"
  }
];

// ── Main component ─────────────────────────────────────────────────────

export function DesignSampleClient() {
  const [cmdKOpen, setCmdKOpen] = useState(false);

  // ⌘K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdKOpen((v) => !v);
      }
      if (e.key === "Escape") setCmdKOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      className="mx-auto max-w-7xl px-6 py-10"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Page intro ──────────────────────────────────────────────── */}
      <header className="mb-12">
        <div
          className="mb-3 text-xs font-medium uppercase tracking-[0.2em]"
          style={{ color: "#5B7FB0" }}
        >
          Redesign Preview · Pick Your Direction
        </div>
        <h1
          className="mb-3 text-4xl font-semibold leading-tight md:text-5xl"
          style={{
            fontFamily: "'Clash Grotesk', 'Inter', system-ui",
            letterSpacing: "-0.02em"
          }}
        >
          Three fonts. Three accents. Three directions.
          <br />
          <span style={{ color: TOKENS.textSecondary }}>One decision.</span>
        </h1>
        <p
          className="max-w-2xl text-base"
          style={{ color: TOKENS.textSecondary, lineHeight: 1.6 }}
        >
          Every section below is a live comparison. Scroll through, find the
          combination that feels right, and tell me which you want shipped.
          Press <KeyHint>⌘ K</KeyHint> to preview the command palette.
        </p>
      </header>

      {/* ── 1. Font comparison ──────────────────────────────────────── */}
      <Section
        eyebrow="01 · Typography"
        title="Which font carries the whole product?"
        description="Same content, three fonts. Read them at normal screen distance — the one that disappears fastest is usually the right one."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {FONTS.map((font) => (
            <FontCard key={font.id} font={font} />
          ))}
        </div>
      </Section>

      {/* ── 2. Accent color comparison ──────────────────────────────── */}
      <Section
        eyebrow="02 · Accent Color"
        title="Which steel blue replaces the red-and-rainbow-icons mess?"
        description="All three sit in the same steel-blue family. The difference is subtle — but it sets the whole product's emotional temperature."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {ACCENTS.map((accent) => (
            <AccentCard key={accent.id} accent={accent} />
          ))}
        </div>
      </Section>

      {/* ── 3. Style direction comparison ───────────────────────────── */}
      <Section
        eyebrow="03 · Style Direction"
        title="Which feel matches Ghost ProtoClaw?"
        description="Three mini-dashboards in three directions. The sidebar, cards, and typography stay identical across them — only the visual vibe shifts."
      >
        <div className="grid gap-6">
          {STYLES.map((style) => (
            <StyleDashboard key={style.id} style={style} />
          ))}
        </div>
      </Section>

      {/* ── 4. Command palette preview ──────────────────────────────── */}
      <Section
        eyebrow="04 · Command Palette"
        title="⌘K — the one feature that makes a 28-item sidebar irrelevant"
        description="Every page, every business, every agent, every workflow — all one keystroke away. Press ⌘ K anywhere in the app."
      >
        <div
          className="flex items-center justify-between rounded-xl border p-6"
          style={{
            background: TOKENS.bgSurface,
            borderColor: TOKENS.border
          }}
        >
          <div>
            <div
              className="mb-1 text-sm font-medium"
              style={{ color: TOKENS.textPrimary }}
            >
              Try it now — press{" "}
              <KeyHint>{"⌘"}</KeyHint> <KeyHint>K</KeyHint>
            </div>
            <div className="text-xs" style={{ color: TOKENS.textMuted }}>
              Or click the button on the right to see the preview.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCmdKOpen(true)}
            className="rounded-md border px-4 py-2 text-sm transition hover:brightness-110"
            style={{
              background: "#5B7FB0",
              borderColor: "#5B7FB0",
              color: "#08090B",
              fontWeight: 600
            }}
          >
            Open command palette
          </button>
        </div>
      </Section>

      {/* ── Decision summary at the bottom ──────────────────────────── */}
      <Section
        eyebrow="Your Decisions"
        title="Ready to ship?"
        description="When you've picked, reply here with: (a) font choice (Inter / Geist / Satoshi), (b) accent (Cool / Classic / Warm), (c) style direction (Quiet / Cinematic / Hybrid), (d) ⌘K — ship it or later."
      >
        <div
          className="rounded-xl border p-6"
          style={{
            background: TOKENS.bgSurface,
            borderColor: TOKENS.border
          }}
        >
          <div
            className="mb-4 text-xs uppercase tracking-widest"
            style={{ color: TOKENS.textMuted }}
          >
            My recommendation if you can&apos;t decide
          </div>
          <div
            className="mb-4 grid gap-x-8 gap-y-3 md:grid-cols-4"
            style={{ color: TOKENS.textPrimary }}
          >
            <RecItem label="Font" value="Geist" />
            <RecItem label="Accent" value="Classic Steel" />
            <RecItem label="Direction" value="Hybrid" />
            <RecItem label="⌘K" value="Ship now" />
          </div>
          <p
            className="text-sm leading-relaxed"
            style={{ color: TOKENS.textSecondary }}
          >
            Geist reads premium without being fussy, classic steel sits in
            the center of the palette (easy to warm or cool later), hybrid
            gives Linear-grade calm for daily work while keeping the AI
            moments cinematic. Command palette is a Day 1 win — it makes the
            nav consolidation work immediately regardless of how we slice
            the sidebar.
          </p>
        </div>
      </Section>

      {cmdKOpen && <CommandPalette onClose={() => setCmdKOpen(false)} />}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function Section({
  eyebrow,
  title,
  description,
  children
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-16">
      <div className="mb-6">
        <div
          className="mb-2 text-xs font-medium uppercase tracking-[0.2em]"
          style={{ color: "#5B7FB0" }}
        >
          {eyebrow}
        </div>
        <h2
          className="mb-2 text-2xl font-semibold leading-tight md:text-3xl"
          style={{
            fontFamily: "'Clash Grotesk', 'Inter', system-ui",
            letterSpacing: "-0.015em"
          }}
        >
          {title}
        </h2>
        {description && (
          <p
            className="max-w-2xl text-sm"
            style={{ color: TOKENS.textSecondary, lineHeight: 1.6 }}
          >
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mx-0.5 inline-flex items-center justify-center rounded border px-1.5 py-0.5 font-mono text-[10px]"
      style={{
        background: TOKENS.bgSurface2,
        borderColor: TOKENS.border,
        color: TOKENS.textPrimary,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace"
      }}
    >
      {children}
    </span>
  );
}

function RecItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="mb-1 text-[10px] uppercase tracking-widest"
        style={{ color: TOKENS.textMuted }}
      >
        {label}
      </div>
      <div
        className="text-base font-semibold"
        style={{ fontFamily: "'Geist', Inter, system-ui" }}
      >
        {value}
      </div>
    </div>
  );
}

// ── FontCard: shows the same dashboard slice in one font family ───────

function FontCard({ font }: { font: FontSpec }) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border"
      style={{
        background: TOKENS.bgSurface,
        borderColor: TOKENS.border,
        fontFamily: font.family
      }}
    >
      {/* Font label header */}
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{
          borderColor: TOKENS.borderSubtle,
          background: TOKENS.bgSurface2
        }}
      >
        <div>
          <div className="text-base font-semibold">{font.name}</div>
          <div
            className="text-[11px]"
            style={{ color: TOKENS.textMuted }}
          >
            Sample rendered in {font.name}
          </div>
        </div>
        <div
          className="rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{
            borderColor: TOKENS.border,
            color: TOKENS.textSecondary
          }}
        >
          Sans
        </div>
      </div>

      {/* Sample content */}
      <div className="flex-1 px-5 py-5">
        <div
          className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em]"
          style={{ color: "#5B7FB0" }}
        >
          Ghost ProtoClaw · Dashboard
        </div>
        <h3
          className="mb-3 text-2xl font-semibold leading-tight"
          style={{
            fontFamily: font.headlineFamily ?? font.family,
            letterSpacing: "-0.015em"
          }}
        >
          Deploy a 14-agent team
        </h3>
        <p
          className="mb-5 text-sm leading-relaxed"
          style={{ color: TOKENS.textSecondary }}
        >
          {font.blurb}
        </p>

        {/* Mini stat grid */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <MiniStat label="Active businesses" value="3" />
          <MiniStat label="Agents running" value="14" />
          <MiniStat label="Today's cost" value="$12.47" mono />
          <MiniStat label="Pending approvals" value="2" />
        </div>

        {/* Mini activity row */}
        <div
          className="flex items-center justify-between rounded-md border px-3 py-2 text-[12px]"
          style={{
            borderColor: TOKENS.borderSubtle,
            background: TOKENS.bgSurface2
          }}
        >
          <span style={{ color: TOKENS.textPrimary }}>
            Workflow ran on schedule
          </span>
          <span
            className="font-mono"
            style={{
              color: TOKENS.textMuted,
              fontFamily: "'JetBrains Mono', monospace"
            }}
          >
            50m ago
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{
        borderColor: TOKENS.borderSubtle,
        background: TOKENS.bgSurface2
      }}
    >
      <div
        className="text-[9px] uppercase tracking-widest"
        style={{ color: TOKENS.textMuted }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-lg font-semibold"
        style={{
          fontFamily: mono
            ? "'JetBrains Mono', monospace"
            : undefined,
          color: TOKENS.textPrimary
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── AccentCard: shows one accent variant applied to real UI ───────────

function AccentCard({ accent }: { accent: AccentSpec }) {
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: TOKENS.bgSurface,
        borderColor: TOKENS.border
      }}
    >
      {/* Header with swatch */}
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{
          borderColor: TOKENS.borderSubtle,
          background: TOKENS.bgSurface2
        }}
      >
        <div>
          <div className="text-base font-semibold">{accent.name}</div>
          <div
            className="font-mono text-[11px]"
            style={{
              color: TOKENS.textMuted,
              fontFamily: "'JetBrains Mono', monospace"
            }}
          >
            {accent.hex}
          </div>
        </div>
        <div className="flex gap-1">
          <div
            className="h-8 w-8 rounded"
            style={{ background: accent.deep }}
          />
          <div
            className="h-8 w-8 rounded"
            style={{ background: accent.hex }}
          />
          <div
            className="h-8 w-8 rounded"
            style={{ background: accent.bright }}
          />
        </div>
      </div>

      {/* Applied samples */}
      <div className="px-5 py-5">
        <p
          className="mb-4 text-xs leading-relaxed"
          style={{ color: TOKENS.textSecondary }}
        >
          {accent.blurb}
        </p>

        {/* Active sidebar item simulation */}
        <div
          className="mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
          style={{
            background: `${accent.hex}22`,
            color: accent.bright,
            borderLeft: `2px solid ${accent.hex}`
          }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: accent.bright,
              boxShadow: `0 0 8px ${accent.hex}`
            }}
          />
          Dashboard (active)
        </div>
        <div
          className="mb-4 rounded-md px-3 py-2 text-sm"
          style={{ color: TOKENS.textSecondary }}
        >
          Workflows
        </div>

        {/* Primary button */}
        <button
          type="button"
          className="mb-3 w-full rounded-md px-4 py-2 text-sm transition hover:brightness-110"
          style={{
            background: accent.hex,
            color: "#08090B",
            fontWeight: 600
          }}
        >
          Deploy agent
        </button>

        {/* Ghost button */}
        <button
          type="button"
          className="w-full rounded-md border px-4 py-2 text-sm transition"
          style={{
            borderColor: accent.hex,
            color: accent.bright,
            background: "transparent"
          }}
        >
          Connect integration
        </button>

        {/* Focus ring preview */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Type to test focus ring…"
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none transition"
            style={{
              borderColor: TOKENS.border,
              color: TOKENS.textPrimary
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = accent.hex;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${accent.hex}40`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = TOKENS.border;
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── StyleDashboard: shows a mini dashboard in a given style direction ─

function StyleDashboard({ style }: { style: StyleSpec }) {
  const accent = "#5B7FB0"; // classic steel for the demos

  const isQuiet = style.id === "quiet";
  const isCinematic = style.id === "cinematic";
  const isHybrid = style.id === "hybrid";

  // Style-specific visual flourishes
  const cardStyle: React.CSSProperties = {
    background: isCinematic ? "rgba(22, 25, 34, 0.65)" : TOKENS.bgSurface,
    borderColor: isCinematic ? "rgba(91, 127, 176, 0.25)" : TOKENS.border,
    backdropFilter: isCinematic ? "blur(12px)" : undefined,
    boxShadow: isCinematic
      ? "0 0 40px rgba(91, 127, 176, 0.08)"
      : undefined
  };

  const hoverGlow = isCinematic || isHybrid;

  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: TOKENS.bgSurface,
        borderColor: TOKENS.border
      }}
    >
      {/* Label header */}
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{
          borderColor: TOKENS.borderSubtle,
          background: TOKENS.bgSurface2
        }}
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold">{style.name}</div>
            {isHybrid && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                style={{
                  background: `${accent}30`,
                  color: "#7FA1D1"
                }}
              >
                Recommended
              </span>
            )}
          </div>
          <div
            className="mt-0.5 text-[11px]"
            style={{ color: TOKENS.textMuted }}
          >
            {style.examples}
          </div>
        </div>
        <p
          className="max-w-md text-right text-[11px] leading-relaxed"
          style={{ color: TOKENS.textSecondary }}
        >
          {style.blurb}
        </p>
      </div>

      {/* Mini dashboard layout */}
      <div
        className="relative grid grid-cols-12 gap-4 p-5"
        style={{
          background: isCinematic
            ? "radial-gradient(ellipse at top right, rgba(91,127,176,0.06), transparent 60%), #08090B"
            : TOKENS.bgApp,
          minHeight: 340,
          fontFamily: "'Geist', 'Inter', system-ui"
        }}
      >
        {/* Mini sidebar */}
        <div className="col-span-3">
          <div
            className="mb-3 text-[9px] font-medium uppercase tracking-[0.2em]"
            style={{ color: TOKENS.textMuted }}
          >
            Workspace
          </div>
          {["Today", "Work", "Team", "Automate", "Library", "Connect"].map(
            (label, idx) => {
              const active = idx === 0;
              return (
                <div
                  key={label}
                  className="mb-1 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition"
                  style={{
                    background: active
                      ? isCinematic
                        ? `${accent}20`
                        : `${accent}18`
                      : "transparent",
                    color: active
                      ? isCinematic
                        ? "#7FA1D1"
                        : TOKENS.textPrimary
                      : TOKENS.textSecondary,
                    borderLeft: active
                      ? `2px solid ${accent}`
                      : "2px solid transparent"
                  }}
                >
                  <div
                    className="h-1 w-1 rounded-full"
                    style={{
                      background: active ? accent : TOKENS.textMuted,
                      boxShadow:
                        active && hoverGlow
                          ? `0 0 6px ${accent}`
                          : undefined
                    }}
                  />
                  {label}
                </div>
              );
            }
          )}
        </div>

        {/* Main content */}
        <div className="col-span-9">
          {/* Greeting line */}
          <div
            className="mb-1 text-[10px] font-medium uppercase tracking-widest"
            style={{ color: accent }}
          >
            Tuesday · April 21
          </div>
          <h4
            className="mb-5 text-xl font-semibold"
            style={{
              fontFamily: isQuiet
                ? "'Inter', system-ui"
                : "'Clash Grotesk', 'Inter', system-ui",
              letterSpacing: "-0.015em"
            }}
          >
            Your agents have been busy.
          </h4>

          {/* Stat bento */}
          <div className="mb-4 grid grid-cols-4 gap-2">
            {[
              { label: "Businesses", value: "3", mono: false },
              { label: "Agents", value: "14", mono: false },
              { label: "Spend today", value: "$12.47", mono: true },
              { label: "Pending", value: "2", mono: false }
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border px-3 py-2.5 transition"
                style={cardStyle}
              >
                <div
                  className="text-[9px] uppercase tracking-widest"
                  style={{ color: TOKENS.textMuted }}
                >
                  {stat.label}
                </div>
                <div
                  className="mt-0.5 text-lg font-semibold"
                  style={{
                    fontFamily: stat.mono
                      ? "'JetBrains Mono', monospace"
                      : undefined,
                    color: TOKENS.textPrimary
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Activity row */}
          <div
            className="rounded-md border p-3"
            style={cardStyle}
          >
            <div
              className="mb-2 text-[10px] font-medium uppercase tracking-widest"
              style={{ color: TOKENS.textMuted }}
            >
              Now Running
            </div>
            {[
              {
                name: "Weekly Content Calendar",
                meta: "CMO · 4m remaining",
                color: accent
              },
              {
                name: "Reddit Audience Scan",
                meta: "Research Analyst · queued",
                color: "#4A9C7F"
              }
            ].map((row) => (
              <div
                key={row.name}
                className="mb-1.5 flex items-center justify-between text-[12px]"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: row.color,
                      boxShadow: hoverGlow
                        ? `0 0 6px ${row.color}`
                        : undefined
                    }}
                  />
                  <span style={{ color: TOKENS.textPrimary }}>
                    {row.name}
                  </span>
                </div>
                <span style={{ color: TOKENS.textMuted }}>{row.meta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Command palette preview ────────────────────────────────────────────

function CommandPalette({ onClose }: { onClose: () => void }) {
  const items = [
    {
      group: "Pages",
      results: [
        { icon: "🏠", label: "Today", hint: "Go" },
        { icon: "💬", label: "Inbox", hint: "Go" },
        { icon: "🧑‍💼", label: "Agents", hint: "Go" },
        { icon: "⚡", label: "Workflows", hint: "Go" }
      ]
    },
    {
      group: "Actions",
      results: [
        { icon: "➕", label: "New business", hint: "Create" },
        { icon: "🤖", label: "New agent", hint: "Create" },
        { icon: "📋", label: "Add a todo", hint: "Create" }
      ]
    },
    {
      group: "Jump to",
      results: [
        { icon: "🛍️", label: "Ghost ProtoClaw · marketing", hint: "Business" },
        { icon: "🎥", label: "Faceless YouTube · flagship", hint: "Business" }
      ]
    }
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{
        background: "rgba(8, 9, 11, 0.7)",
        backdropFilter: "blur(12px)"
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl"
        style={{
          background: "rgba(16, 18, 23, 0.95)",
          borderColor: "rgba(91, 127, 176, 0.3)",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.6), 0 0 80px rgba(91, 127, 176, 0.15)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="border-b px-4 py-3"
          style={{ borderColor: TOKENS.borderSubtle }}
        >
          <input
            autoFocus
            placeholder="Search pages, actions, businesses…"
            className="w-full bg-transparent text-sm outline-none"
            style={{
              color: TOKENS.textPrimary,
              fontFamily: "'Geist', Inter, system-ui"
            }}
          />
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {items.map((group, gi) => (
            <div key={group.group} className={gi > 0 ? "mt-2" : ""}>
              <div
                className="px-4 py-1 text-[10px] font-medium uppercase tracking-widest"
                style={{ color: TOKENS.textMuted }}
              >
                {group.group}
              </div>
              {group.results.map((item, idx) => (
                <button
                  key={item.label}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm transition hover:bg-white/5"
                  style={{
                    color: TOKENS.textPrimary,
                    background:
                      gi === 0 && idx === 0 ? "rgba(91, 127, 176, 0.12)" : undefined
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <span
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: TOKENS.textMuted }}
                  >
                    {item.hint}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t px-4 py-2 text-[10px]"
          style={{
            borderColor: TOKENS.borderSubtle,
            color: TOKENS.textMuted
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <KeyHint>↑</KeyHint>
              <KeyHint>↓</KeyHint> Navigate
            </span>
            <span className="flex items-center gap-1">
              <KeyHint>↵</KeyHint> Select
            </span>
            <span className="flex items-center gap-1">
              <KeyHint>esc</KeyHint> Close
            </span>
          </div>
          <span>Preview · not wired to pages yet</span>
        </div>
      </div>
    </div>
  );
}
