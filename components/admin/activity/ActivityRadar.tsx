"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ActivityEvent,
  PulseAgent,
  PulseBusiness,
  PulseTopology
} from "@/components/admin/activity/types";

type ActivityRadarProps = {
  topology: PulseTopology;
};

type Position = { x: number; y: number };
type LaidOutAgent = {
  agent: PulseAgent;
  business: PulseBusiness;
  position: Position;
  businessRing: number;
};
type Pulse = {
  id: string;
  position: Position;
  color: string;
  bornAt: number;
};

const VIEWBOX = 900;
const CENTER = VIEWBOX / 2;
const RING_START = 140;
const RING_GAP = 110;
const PULSE_DURATION_MS = 2600;
const POLL_INTERVAL_MS = 5000;

// Premium radar palette — deep navy base, soft neon accents
const COLORS = {
  bg1: "#060a12",
  bg2: "#0a0f1c",
  gridLine: "#1a2434",
  orbit: "#223044",
  orbitHighlight: "#2d4058",
  sweep: "rgba(125, 211, 252, 0.14)",
  sweepEdge: "rgba(125, 211, 252, 0.55)",
  master: { ring: "#a78bfa", fill: "#1a152a", glow: "#8b5cf6" },
  blip: { ring: "#38bdf8", fill: "#0b1628", inactiveRing: "#334155" },
  blipActive: "#fbbf24",
  label: "#94a3b8",
  labelStrong: "#e2e8f0"
};

const STATUS_COLOR: Record<string, string> = {
  failed: "#f87171",
  error: "#f87171",
  running: "#fbbf24",
  pending: "#fbbf24",
  completed: "#34d399",
  default: "#7dd3fc"
};

function colorFor(status: string | null, kind: string) {
  if (status && STATUS_COLOR[status]) return STATUS_COLOR[status];
  if (kind === "tool_call") return "#fbbf24";
  return STATUS_COLOR.default;
}

function layout(topology: PulseTopology) {
  const rings: Array<{ business: PulseBusiness; radius: number; index: number }> =
    topology.businesses.map((business, index) => ({
      business,
      radius: RING_START + index * RING_GAP,
      index
    }));

  const agents: LaidOutAgent[] = [];
  const agentIndex = new Map<string, LaidOutAgent>();

  for (const ring of rings) {
    const count = Math.max(ring.business.agents.length, 1);
    // Alternate rings offset their starting angle so blips don't all line up
    // at 0°; this spreads the visual density around the radar.
    const offset = (ring.index % 2) * (Math.PI / count);
    ring.business.agents.forEach((agent, i) => {
      const angle = (i / count) * Math.PI * 2 + offset - Math.PI / 2;
      const x = CENTER + Math.cos(angle) * ring.radius;
      const y = CENTER + Math.sin(angle) * ring.radius;
      const laid: LaidOutAgent = {
        agent,
        business: ring.business,
        position: { x, y },
        businessRing: ring.index
      };
      agents.push(laid);
      agentIndex.set(agent.id, laid);
    });
  }
  return { rings, agents, agentIndex };
}

function useEventStream(paused: boolean) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;
    const seed = async () => {
      try {
        const res = await fetch("/api/admin/activity/stream?limit=1", {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = (await res.json()) as { serverTime: string };
        lastSeenRef.current = data.serverTime;
      } catch {
        /* retry next tick */
      }
    };
    const poll = async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("limit", "40");
        if (lastSeenRef.current) qs.set("since", lastSeenRef.current);
        const res = await fetch(`/api/admin/activity/stream?${qs}`, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          events: ActivityEvent[];
          serverTime: string;
        };
        if (cancelled) return;
        if (data.events.length > 0) {
          setEvents(data.events);
          lastSeenRef.current = data.events[0].createdAt;
        } else if (!lastSeenRef.current) {
          lastSeenRef.current = data.serverTime;
        }
      } catch {
        /* ignore */
      }
    };
    void seed();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [paused]);

  return events;
}

export function ActivityRadar({ topology }: ActivityRadarProps) {
  const [paused, setPaused] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [sweepAngle, setSweepAngle] = useState(0);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(true);

  const { rings, agents, agentIndex } = useMemo(() => layout(topology), [topology]);
  const newEvents = useEventStream(paused);

  useEffect(() => {
    if (newEvents.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(false);
    const now = Date.now();
    const fresh: Pulse[] = [];
    for (const event of newEvents) {
      if (!event.agentId) continue;
      const laid = agentIndex.get(event.agentId);
      if (!laid) continue;
      fresh.push({
        id: `${event.id}:${now}`,
        position: laid.position,
        color: colorFor(event.status, event.kind),
        bornAt: now
      });
    }
    if (fresh.length === 0) return;
    setPulses((prev) => [...prev, ...fresh]);
    const t = setTimeout(() => {
      setPulses((prev) =>
        prev.filter((p) => Date.now() - p.bornAt < PULSE_DURATION_MS + 200)
      );
    }, PULSE_DURATION_MS + 250);
    return () => clearTimeout(t);
  }, [newEvents, agentIndex]);

  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = t - last;
      last = t;
      setSweepAngle((a) => (a + dt * 0.04) % 360);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  const handleBlipClick = useCallback(
    (id: string) => setSelectedAgentId((c) => (c === id ? null : c) ?? id),
    []
  );

  const focusedId = hoveredAgentId ?? selectedAgentId;
  const focusedRing = focusedId ? agentIndex.get(focusedId)?.businessRing ?? null : null;

  const selected = selectedAgentId ? agentIndex.get(selectedAgentId) ?? null : null;
  const master = topology.master;

  return (
    <div className="flex h-full">
      <div
        className="relative flex min-w-0 flex-1 flex-col"
        style={{ background: COLORS.bg1 }}
      >
        <div
          className="flex items-center gap-3 border-b px-5 py-3"
          style={{ borderColor: COLORS.gridLine }}
        >
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="relative flex h-2 w-2">
              {!paused ? (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ background: "#34d399" }}
                />
              ) : null}
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: paused ? "#475569" : "#34d399" }}
              />
            </span>
            {paused ? "Paused" : "Live sweep"}
          </div>
          <div className="text-xs tracking-wide text-slate-500">
            {agents.length} agents · {topology.businesses.length} businesses
          </div>
          <div className="ml-auto">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPaused((p) => !p)}
              className="h-7 gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              {paused ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-xs text-slate-600">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Waiting for activity…
            </div>
          ) : null}

          {agents.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-xs text-slate-500">
              No active agents on this radar yet.
            </div>
          ) : null}

          <svg
            viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
            className="h-full w-full select-none"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="radar-bg" cx="50%" cy="50%" r="62%">
                <stop offset="0%" stopColor={COLORS.bg2} stopOpacity="1" />
                <stop offset="100%" stopColor={COLORS.bg1} stopOpacity="1" />
              </radialGradient>
              <radialGradient id="radar-sweep-grad">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="70%" stopColor={COLORS.sweep} />
                <stop offset="100%" stopColor={COLORS.sweepEdge} />
              </radialGradient>
              <radialGradient id="radar-master-glow">
                <stop offset="0%" stopColor={COLORS.master.glow} stopOpacity="0.55" />
                <stop offset="100%" stopColor={COLORS.master.glow} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="radar-blip-glow">
                <stop offset="0%" stopColor={COLORS.blip.ring} stopOpacity="0.55" />
                <stop offset="100%" stopColor={COLORS.blip.ring} stopOpacity="0" />
              </radialGradient>
              <pattern
                id="radar-dots"
                width="32"
                height="32"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r="1" fill={COLORS.gridLine} />
              </pattern>
              <filter id="blip-glow">
                <feGaussianBlur stdDeviation="2" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="1.4" />
                </feComponentTransfer>
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#radar-bg)" />
            <rect width="100%" height="100%" fill="url(#radar-dots)" opacity="0.35" />

            {/* Crosshair lines */}
            <line
              x1={0}
              y1={CENTER}
              x2={VIEWBOX}
              y2={CENTER}
              stroke={COLORS.gridLine}
              strokeWidth="0.5"
            />
            <line
              x1={CENTER}
              y1={0}
              x2={CENTER}
              y2={VIEWBOX}
              stroke={COLORS.gridLine}
              strokeWidth="0.5"
            />

            {/* Orbit rings */}
            {rings.map((ring) => {
              const highlighted = focusedRing === ring.index;
              return (
                <g key={ring.business.id}>
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={ring.radius}
                    fill="none"
                    stroke={highlighted ? COLORS.orbitHighlight : COLORS.orbit}
                    strokeWidth={highlighted ? 1.2 : 0.8}
                    strokeDasharray={highlighted ? "0" : "3 5"}
                    opacity={highlighted ? 0.9 : 0.65}
                    style={{ transition: "stroke 180ms, opacity 180ms" }}
                  />
                  <text
                    x={CENTER + ring.radius + 10}
                    y={CENTER - 2}
                    fill={highlighted ? COLORS.labelStrong : COLORS.label}
                    fontSize="9"
                    fontFamily="'JetBrains Mono', ui-monospace, monospace"
                    letterSpacing="0.08em"
                  >
                    {ring.business.name.toUpperCase()}
                  </text>
                </g>
              );
            })}

            {/* Sweep — slim gradient arc, not a cone */}
            <g
              transform={`rotate(${sweepAngle} ${CENTER} ${CENTER})`}
              style={{ pointerEvents: "none" }}
            >
              <path
                d={`M ${CENTER} ${CENTER} L ${CENTER + VIEWBOX * 0.47} ${CENTER} A ${VIEWBOX * 0.47} ${VIEWBOX * 0.47} 0 0 0 ${CENTER + VIEWBOX * 0.47 * Math.cos(-Math.PI / 4)} ${CENTER + VIEWBOX * 0.47 * Math.sin(-Math.PI / 4)} Z`}
                fill="url(#radar-sweep-grad)"
                opacity="0.7"
              />
            </g>

            {/* Master / Mission Control */}
            <g>
              <circle cx={CENTER} cy={CENTER} r={70} fill="url(#radar-master-glow)" />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={22}
                fill={COLORS.master.fill}
                stroke={COLORS.master.ring}
                strokeWidth="1.2"
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={4}
                fill={COLORS.master.ring}
              />
              <text
                x={CENTER}
                y={CENTER + 40}
                textAnchor="middle"
                fill={COLORS.labelStrong}
                fontSize="9"
                letterSpacing="0.15em"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
              >
                {(master?.displayName ?? "MISSION CONTROL").toUpperCase()}
              </text>
            </g>

            {/* Pulses — rendered beneath blips so the blip sits on top */}
            {pulses.map((pulse) => (
              <circle
                key={pulse.id}
                cx={pulse.position.x}
                cy={pulse.position.y}
                r={6}
                fill="none"
                stroke={pulse.color}
                strokeWidth="1.5"
              >
                <animate
                  attributeName="r"
                  from="6"
                  to="70"
                  dur={`${PULSE_DURATION_MS / 1000}s`}
                  fill="freeze"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.85;0"
                  keyTimes="0;0.15;1"
                  dur={`${PULSE_DURATION_MS / 1000}s`}
                  fill="freeze"
                />
              </circle>
            ))}

            {/* Agent blips */}
            {agents.map(({ agent, business, position, businessRing }) => {
              const isSelected = agent.id === selectedAgentId;
              const isHovered = agent.id === hoveredAgentId;
              const isFocusedRing = focusedRing === businessRing;
              const dimmed = focusedRing !== null && !isFocusedRing;
              const recentlyPulsed = pulses.some(
                (p) =>
                  p.position.x === position.x &&
                  p.position.y === position.y &&
                  Date.now() - p.bornAt < 600
              );

              return (
                <g
                  key={agent.id}
                  onClick={() => handleBlipClick(agent.id)}
                  onPointerEnter={() => setHoveredAgentId(agent.id)}
                  onPointerLeave={() =>
                    setHoveredAgentId((id) => (id === agent.id ? null : id))
                  }
                  style={{
                    cursor: "pointer",
                    opacity: dimmed ? 0.3 : 1,
                    transition: "opacity 180ms"
                  }}
                >
                  <title>{`${agent.displayName} — ${business.name}`}</title>
                  {(isHovered || isSelected || recentlyPulsed) ? (
                    <circle
                      cx={position.x}
                      cy={position.y}
                      r={24}
                      fill="url(#radar-blip-glow)"
                    />
                  ) : null}
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={isSelected ? 10 : isHovered ? 9 : 7}
                    fill={COLORS.blip.fill}
                    stroke={
                      recentlyPulsed
                        ? COLORS.blipActive
                        : isSelected || isHovered
                          ? COLORS.blip.ring
                          : COLORS.blip.inactiveRing
                    }
                    strokeWidth={isSelected ? 1.8 : 1.2}
                    style={{ transition: "r 160ms, stroke 160ms" }}
                  />
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={2}
                    fill={
                      recentlyPulsed
                        ? COLORS.blipActive
                        : isHovered || isSelected
                          ? COLORS.blip.ring
                          : "#475569"
                    }
                  />
                  <text
                    x={position.x}
                    y={position.y + 22}
                    textAnchor="middle"
                    fontSize="9"
                    fontFamily="'Inter', ui-sans-serif, system-ui, sans-serif"
                    fontWeight={isHovered || isSelected ? 500 : 400}
                    fill={
                      isHovered || isSelected
                        ? COLORS.labelStrong
                        : COLORS.label
                    }
                    style={{ pointerEvents: "none", letterSpacing: "0.02em" }}
                  >
                    {agent.displayName}
                  </text>
                </g>
              );
            })}
          </svg>

          <div
            className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-black/40 px-3 py-2 text-[10px] text-slate-400 backdrop-blur"
            style={{ borderColor: COLORS.gridLine }}
          >
            hover an orbit to focus a business · click a blip for detail
          </div>
        </div>
      </div>

      <aside
        className="hidden w-80 shrink-0 flex-col border-l lg:flex"
        style={{ borderColor: COLORS.gridLine, background: "#070c16" }}
      >
        <div
          className="border-b px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400"
          style={{ borderColor: COLORS.gridLine }}
        >
          {selected ? "Agent" : "Radar"}
        </div>
        {selected ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="space-y-1">
              <div
                className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                style={{
                  background: `${COLORS.blip.ring}1a`,
                  color: COLORS.blip.ring
                }}
              >
                {selected.agent.type}
              </div>
              <div className="text-lg font-semibold text-white">
                {selected.agent.displayName}
              </div>
            </div>
            <FieldRow label="Role" value={selected.agent.role} />
            <FieldRow label="Business" value={selected.business.name} />
            <FieldRow label="Orbit" value={`Ring ${selected.businessRing + 1}`} />
            <div
              className="rounded-md border p-3 text-xs leading-5 text-slate-400"
              style={{ borderColor: COLORS.gridLine, background: "#0b1220" }}
            >
              Switch to the Feed tab and filter by this agent to see their
              full activity history with error details.
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-xs">
            <div className="space-y-2">
              <Header>How to read it</Header>
              <p className="leading-5 text-slate-400">
                Each business gets its own orbit around Mission Control, and
                each of that business&apos;s agents is a blip on that orbit.
                When an event fires, a ring pulses outward from the blip in a
                color that matches the event type.
              </p>
            </div>
            <div className="space-y-2">
              <Header>Pulse colors</Header>
              <LegendRow color={STATUS_COLOR.default} label="Chat / action" />
              <LegendRow color="#fbbf24" label="Tool call" />
              <LegendRow color={STATUS_COLOR.completed} label="Completed" />
              <LegendRow color={STATUS_COLOR.failed} label="Failed" />
            </div>
            <div className="space-y-2">
              <Header>Controls</Header>
              <div className="space-y-1 leading-5 text-slate-400">
                <div>Hover a blip to highlight its orbit</div>
                <div>Click a blip to open the detail panel</div>
                <div>Pause to freeze the sweep</div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      <span className="text-slate-300">{label}</span>
    </div>
  );
}
