/**
 * AgentRoleIcon — SVG-based robotic/tech icons for agent roles.
 *
 * Each icon sits inside a 32x32 viewBox with a #141414 background,
 * sharp corners (rx="3"), and uses #e63946 as the accent color with
 * opacity variations for depth.
 */

const BRAND = "#e63946";
const BG = "#141414";

type IconRenderer = (props: { brand: string }) => React.ReactNode;

// ── Icon definitions ────────────────────────────────────────────────

/** Robotic head with antenna and glowing eye */
const CeoIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Antenna */}
    <line x1="16" y1="4" x2="16" y2="8" stroke={brand} strokeWidth="1.5" opacity="0.6" />
    <circle cx="16" cy="3.5" r="1.5" fill={brand} opacity="0.9" />
    {/* Head */}
    <rect x="9" y="8" width="14" height="12" rx="2" fill={brand} opacity="0.9" />
    {/* Eye */}
    <circle cx="16" cy="13" r="2.5" fill={BG} />
    <circle cx="16" cy="13" r="1.2" fill={brand} opacity="0.6" />
    {/* Jaw line */}
    <rect x="11" y="22" width="10" height="3" rx="1" fill={brand} opacity="0.3" />
    {/* Ear nodes */}
    <rect x="6" y="11" width="3" height="5" rx="1" fill={brand} opacity="0.6" />
    <rect x="23" y="11" width="3" height="5" rx="1" fill={brand} opacity="0.6" />
  </g>
);

/** Circuit board with connected nodes */
const CooIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Traces */}
    <line x1="8" y1="10" x2="16" y2="10" stroke={brand} strokeWidth="1.2" opacity="0.6" />
    <line x1="16" y1="10" x2="24" y2="10" stroke={brand} strokeWidth="1.2" opacity="0.3" />
    <line x1="16" y1="10" x2="16" y2="22" stroke={brand} strokeWidth="1.2" opacity="0.6" />
    <line x1="8" y1="16" x2="16" y2="16" stroke={brand} strokeWidth="1.2" opacity="0.3" />
    <line x1="16" y1="16" x2="24" y2="16" stroke={brand} strokeWidth="1.2" opacity="0.6" />
    <line x1="8" y1="22" x2="16" y2="22" stroke={brand} strokeWidth="1.2" opacity="0.3" />
    <line x1="16" y1="22" x2="24" y2="22" stroke={brand} strokeWidth="1.2" opacity="0.6" />
    {/* Nodes */}
    <circle cx="8" cy="10" r="2" fill={brand} opacity="0.9" />
    <circle cx="24" cy="10" r="2" fill={brand} opacity="0.6" />
    <circle cx="16" cy="16" r="2.5" fill={brand} opacity="0.9" />
    <circle cx="8" cy="16" r="1.5" fill={brand} opacity="0.6" />
    <circle cx="24" cy="16" r="1.5" fill={brand} opacity="0.3" />
    <circle cx="8" cy="22" r="1.5" fill={brand} opacity="0.3" />
    <circle cx="24" cy="22" r="2" fill={brand} opacity="0.9" />
    <circle cx="16" cy="22" r="1.5" fill={brand} opacity="0.6" />
  </g>
);

/** Code brackets with a gear */
const CtoIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Left bracket */}
    <path d="M8 9 L5 16 L8 23" stroke={brand} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    {/* Right bracket */}
    <path d="M24 9 L27 16 L24 23" stroke={brand} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    {/* Gear center */}
    <circle cx="16" cy="16" r="3.5" fill="none" stroke={brand} strokeWidth="1.5" opacity="0.6" />
    <circle cx="16" cy="16" r="1.5" fill={brand} opacity="0.9" />
    {/* Gear teeth */}
    <line x1="16" y1="11" x2="16" y2="12.5" stroke={brand} strokeWidth="1.5" opacity="0.6" />
    <line x1="16" y1="19.5" x2="16" y2="21" stroke={brand} strokeWidth="1.5" opacity="0.6" />
    <line x1="11" y1="16" x2="12.5" y2="16" stroke={brand} strokeWidth="1.5" opacity="0.6" />
    <line x1="19.5" y1="16" x2="21" y2="16" stroke={brand} strokeWidth="1.5" opacity="0.6" />
  </g>
);

/** Signal/broadcast waves from a point */
const CmoIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Source point */}
    <circle cx="8" cy="22" r="2" fill={brand} opacity="0.9" />
    {/* Waves */}
    <path d="M12 22 A6 6 0 0 0 8 16" fill="none" stroke={brand} strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    <path d="M16 22 A10 10 0 0 0 8 12" fill="none" stroke={brand} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    <path d="M20 22 A14 14 0 0 0 8 8" fill="none" stroke={brand} strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
    <path d="M24 22 A18 18 0 0 0 8 4" fill="none" stroke={brand} strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
  </g>
);

/** Bar chart with upward trend */
const CfoIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Bars */}
    <rect x="6" y="18" width="4" height="7" rx="1" fill={brand} opacity="0.3" />
    <rect x="12" y="14" width="4" height="11" rx="1" fill={brand} opacity="0.6" />
    <rect x="18" y="10" width="4" height="15" rx="1" fill={brand} opacity="0.9" />
    <rect x="24" y="6" width="4" height="19" rx="1" fill={brand} opacity="0.9" />
    {/* Trend line */}
    <polyline points="8,17 14,13 20,9 26,5" fill="none" stroke={brand} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    {/* Arrow tip */}
    <polygon points="26,5 23,6 25,8" fill={brand} opacity="0.6" />
  </g>
);

/** Target with crosshair */
const SalesIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Outer ring */}
    <circle cx="16" cy="16" r="10" fill="none" stroke={brand} strokeWidth="1.5" opacity="0.3" />
    {/* Middle ring */}
    <circle cx="16" cy="16" r="6" fill="none" stroke={brand} strokeWidth="1.5" opacity="0.6" />
    {/* Inner ring */}
    <circle cx="16" cy="16" r="2" fill={brand} opacity="0.9" />
    {/* Crosshair lines */}
    <line x1="16" y1="3" x2="16" y2="10" stroke={brand} strokeWidth="1.2" opacity="0.6" />
    <line x1="16" y1="22" x2="16" y2="29" stroke={brand} strokeWidth="1.2" opacity="0.6" />
    <line x1="3" y1="16" x2="10" y2="16" stroke={brand} strokeWidth="1.2" opacity="0.6" />
    <line x1="22" y1="16" x2="29" y2="16" stroke={brand} strokeWidth="1.2" opacity="0.6" />
  </g>
);

/** Headset shape */
const SupportIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Headband arc */}
    <path d="M8 17 A8 9 0 0 1 24 17" fill="none" stroke={brand} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    {/* Left ear cup */}
    <rect x="5" y="15" width="5" height="8" rx="2" fill={brand} opacity="0.9" />
    {/* Right ear cup */}
    <rect x="22" y="15" width="5" height="8" rx="2" fill={brand} opacity="0.9" />
    {/* Mic arm */}
    <path d="M22 23 Q22 27, 18 27" fill="none" stroke={brand} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    {/* Mic */}
    <circle cx="17" cy="27" r="1.5" fill={brand} opacity="0.3" />
  </g>
);

/** Pen with sparkle */
const ContentIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Pen body */}
    <line x1="10" y1="24" x2="22" y2="8" stroke={brand} strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
    {/* Pen tip */}
    <polygon points="10,24 8,26 10,26 12,24" fill={brand} opacity="0.6" />
    {/* Pen top */}
    <line x1="22" y1="8" x2="24" y2="6" stroke={brand} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    {/* Sparkle */}
    <line x1="24" y1="12" x2="24" y2="16" stroke={brand} strokeWidth="1" strokeLinecap="round" opacity="0.9" />
    <line x1="22" y1="14" x2="26" y2="14" stroke={brand} strokeWidth="1" strokeLinecap="round" opacity="0.9" />
    {/* Small sparkle */}
    <line x1="7" y1="7" x2="7" y2="10" stroke={brand} strokeWidth="0.8" strokeLinecap="round" opacity="0.3" />
    <line x1="5.5" y1="8.5" x2="8.5" y2="8.5" stroke={brand} strokeWidth="0.8" strokeLinecap="round" opacity="0.3" />
  </g>
);

/** Magnifying glass with data nodes */
const ResearchIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Glass circle */}
    <circle cx="14" cy="14" r="7" fill="none" stroke={brand} strokeWidth="2" opacity="0.9" />
    {/* Handle */}
    <line x1="19" y1="19" x2="26" y2="26" stroke={brand} strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
    {/* Data nodes inside glass */}
    <circle cx="12" cy="12" r="1.2" fill={brand} opacity="0.6" />
    <circle cx="16" cy="11" r="1.2" fill={brand} opacity="0.9" />
    <circle cx="14" cy="16" r="1.2" fill={brand} opacity="0.6" />
    {/* Node connections */}
    <line x1="12" y1="12" x2="16" y2="11" stroke={brand} strokeWidth="0.8" opacity="0.3" />
    <line x1="16" y1="11" x2="14" y2="16" stroke={brand} strokeWidth="0.8" opacity="0.3" />
    <line x1="14" y1="16" x2="12" y2="12" stroke={brand} strokeWidth="0.8" opacity="0.3" />
  </g>
);

/** Standard robot head */
const DefaultIcon: IconRenderer = ({ brand }) => (
  <g>
    {/* Head */}
    <rect x="8" y="8" width="16" height="14" rx="3" fill={brand} opacity="0.9" />
    {/* Eyes */}
    <circle cx="13" cy="14" r="2" fill={BG} />
    <circle cx="19" cy="14" r="2" fill={BG} />
    <circle cx="13" cy="14" r="0.8" fill={brand} opacity="0.6" />
    <circle cx="19" cy="14" r="0.8" fill={brand} opacity="0.6" />
    {/* Mouth */}
    <rect x="12" y="18" width="8" height="1.5" rx="0.5" fill={BG} />
    {/* Antenna */}
    <line x1="16" y1="4" x2="16" y2="8" stroke={brand} strokeWidth="1.5" opacity="0.6" />
    <circle cx="16" cy="3.5" r="1.5" fill={brand} opacity="0.3" />
    {/* Ear bolts */}
    <circle cx="6.5" cy="15" r="1.5" fill={brand} opacity="0.3" />
    <circle cx="25.5" cy="15" r="1.5" fill={brand} opacity="0.3" />
  </g>
);

// ── Role matching ───────────────────────────────────────────────────

type RoleMapping = {
  keywords: string[];
  icon: IconRenderer;
};

const ROLE_MAP: RoleMapping[] = [
  { keywords: ["ceo", "executive", "chief executive", "founder", "owner"], icon: CeoIcon },
  { keywords: ["coo", "operations", "strategist", "ops"], icon: CooIcon },
  { keywords: ["cto", "builder", "developer", "tech", "engineer", "code"], icon: CtoIcon },
  { keywords: ["cmo", "marketing", "growth", "brand"], icon: CmoIcon },
  { keywords: ["cfo", "finance", "revenue", "accounting", "financial"], icon: CfoIcon },
  { keywords: ["sales", "business development", "deal", "bdr", "sdr"], icon: SalesIcon },
  { keywords: ["support", "customer", "service", "helpdesk", "success"], icon: SupportIcon },
  { keywords: ["content", "writer", "creative", "editor", "copy"], icon: ContentIcon },
  { keywords: ["research", "analyst", "data", "intelligence", "insight"], icon: ResearchIcon },
];

function matchRole(role: string): IconRenderer {
  const lower = role.toLowerCase();
  for (const mapping of ROLE_MAP) {
    for (const keyword of mapping.keywords) {
      if (lower.includes(keyword)) {
        return mapping.icon;
      }
    }
  }
  return DefaultIcon;
}

// ── Public API ──────────────────────────────────────────────────────

export function getAgentRoleFromAgent(agent: {
  displayName?: string | null;
  type?: string | null;
  systemPrompt?: string | null;
  role?: string | null;
}): string {
  // Try displayName first (often "CEO", "CMO", etc.)
  if (agent.displayName) {
    const matched = matchRole(agent.displayName);
    if (matched !== DefaultIcon) return agent.displayName;
  }
  // Then role
  if (agent.role) {
    const matched = matchRole(agent.role);
    if (matched !== DefaultIcon) return agent.role;
  }
  // Then type
  if (agent.type) {
    const matched = matchRole(agent.type);
    if (matched !== DefaultIcon) return agent.type;
  }
  // Then system prompt
  if (agent.systemPrompt) {
    const matched = matchRole(agent.systemPrompt);
    if (matched !== DefaultIcon) return agent.systemPrompt;
  }
  return agent.displayName ?? agent.role ?? "agent";
}

export function AgentRoleIcon({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  const Icon = matchRole(role);

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="32" height="32" rx="3" fill={BG} />
      <Icon brand={BRAND} />
    </svg>
  );
}
