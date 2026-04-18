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
};

type Pulse = {
  id: string;
  eventId: string;
  position: Position;
  kind: string;
  status: string | null;
  bornAt: number;
};

const VIEWBOX = 800;
const CENTER = VIEWBOX / 2;
const RING_START = 120;
const RING_GAP = 100;
const PULSE_DURATION_MS = 2200;
const POLL_INTERVAL_MS = 5000;

const STATUS_COLOR: Record<string, string> = {
  failed: "#f43f5e",
  error: "#f43f5e",
  running: "#f59e0b",
  pending: "#f59e0b",
  completed: "#10b981",
  default: "#22d3ee"
};

function colorFor(status: string | null, kind: string) {
  if (status && STATUS_COLOR[status]) return STATUS_COLOR[status];
  if (kind === "tool_call") return "#f59e0b";
  if (kind === "action_run") return "#22d3ee";
  return STATUS_COLOR.default;
}

/**
 * Lay out businesses as concentric orbits around a central Mission Control
 * point. Each business gets its own ring, and that business's agents are
 * spread evenly around the ring. Returns flat lists for easy iteration by
 * the renderer.
 */
function layout(topology: PulseTopology) {
  const rings: Array<{
    business: PulseBusiness;
    radius: number;
    ringIndex: number;
  }> = topology.businesses.map((business, ringIndex) => ({
    business,
    radius: RING_START + ringIndex * RING_GAP,
    ringIndex
  }));

  const agents: LaidOutAgent[] = [];
  const agentIndex = new Map<string, LaidOutAgent>();

  for (const ring of rings) {
    const { business, radius, ringIndex } = ring;
    const count = business.agents.length || 1;
    // Offset each ring slightly so small-count rings don't overlap each other
    const offset = ((ringIndex % 2) * Math.PI) / count;
    business.agents.forEach((agent, i) => {
      const angle = (i / count) * Math.PI * 2 + offset;
      const x = CENTER + Math.cos(angle) * radius;
      const y = CENTER + Math.sin(angle) * radius;
      const laid: LaidOutAgent = {
        agent,
        business,
        position: { x, y }
      };
      agents.push(laid);
      agentIndex.set(agent.id, laid);
    });
  }

  return { rings, agents, agentIndex };
}

/**
 * Client-side fetch loop that polls the same activity stream the Feed uses,
 * but returns only events that appeared since the last poll. This is what
 * drives ripple creation — we only want to animate NEW events, not replay
 * history every tick.
 */
function useNewEventStream(paused: boolean) {
  const [latestEvents, setLatestEvents] = useState<ActivityEvent[]>([]);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    if (paused) return;

    let cancelled = false;

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
          setLatestEvents(data.events);
          // Advance lastSeen to the newest event returned (they're sorted
          // newest-first from the API).
          lastSeenRef.current = data.events[0].createdAt;
        } else if (!lastSeenRef.current) {
          // First tick with no events — anchor so we don't re-fetch the
          // whole history on every tick from here on.
          lastSeenRef.current = data.serverTime;
        }
      } catch {
        // Ignore — next tick will try again
      }
    };

    // Seed: on first mount, anchor to server time so we only animate things
    // from here forward. Otherwise reopening the tab would trigger ripples
    // for every event in history.
    const seed = async () => {
      try {
        const res = await fetch(`/api/admin/activity/stream?limit=1`, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = (await res.json()) as { serverTime: string };
        lastSeenRef.current = data.serverTime;
      } catch {
        // Falls through; poll will set it next tick
      }
    };

    void seed();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [paused]);

  return latestEvents;
}

export function ActivityRadar({ topology }: ActivityRadarProps) {
  const [paused, setPaused] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [sweepAngle, setSweepAngle] = useState(0);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [loading, setLoading] = useState(true);

  const { rings, agents, agentIndex } = useMemo(
    () => layout(topology),
    [topology]
  );

  const newEvents = useNewEventStream(paused);

  // Turn new events into ripple pulses
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
        eventId: event.id,
        position: laid.position,
        kind: event.kind,
        status: event.status,
        bornAt: now
      });
    }
    if (fresh.length === 0) return;
    setPulses((prev) => [...prev, ...fresh]);
    // Evict finished pulses after their animation completes
    const timer = setTimeout(() => {
      setPulses((prev) => prev.filter((p) => Date.now() - p.bornAt < PULSE_DURATION_MS));
    }, PULSE_DURATION_MS + 200);
    return () => clearTimeout(timer);
  }, [newEvents, agentIndex]);

  // Rotating radar sweep (pure visual flourish)
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = t - last;
      last = t;
      setSweepAngle((a) => (a + dt * 0.06) % 360);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  const selectedAgent = selectedAgentId
    ? agentIndex.get(selectedAgentId)?.agent ?? null
    : null;
  const selectedBusiness = selectedAgentId
    ? agentIndex.get(selectedAgentId)?.business ?? null
    : null;

  const handleBlipClick = useCallback(
    (id: string) => setSelectedAgentId((current) => (current === id ? null : id)),
    []
  );

  const master = topology.master;

  return (
    <div className="flex h-full">
      <div className="relative flex min-w-0 flex-1 flex-col bg-ghost-base">
        <div className="flex items-center gap-3 border-b border-ghost-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="relative flex h-2 w-2">
              {!paused ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-active opacity-75" />
              ) : null}
              <span
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  paused ? "bg-slate-500" : "bg-status-active"
                )}
              />
            </span>
            {paused ? "Paused" : "Live sweep"}
          </div>
          <div className="text-xs text-slate-500">
            {agents.length} agents · {topology.businesses.length} businesses
          </div>
          <div className="ml-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-1.5 h-3.5 w-3.5" />
                  Pause
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Waiting for activity…
            </div>
          ) : null}

          {agents.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-slate-500">
              No active agents yet. Create an agent on a business to see it on
              the radar.
            </div>
          ) : null}

          <svg
            viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0e1628" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#050810" stopOpacity="1" />
              </radialGradient>
              <linearGradient id="sweep" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="master-glow">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect
              x="0"
              y="0"
              width={VIEWBOX}
              height={VIEWBOX}
              fill="url(#radar-bg)"
            />

            {/* Orbit rings */}
            {rings.map((ring) => (
              <g key={ring.business.id}>
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={ring.radius}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 4"
                />
                <text
                  x={CENTER + ring.radius + 6}
                  y={CENTER}
                  fill="#64748b"
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                  dominantBaseline="middle"
                >
                  {ring.business.name}
                </text>
              </g>
            ))}

            {/* Crosshairs */}
            <line
              x1={0}
              y1={CENTER}
              x2={VIEWBOX}
              y2={CENTER}
              stroke="#1e293b"
              strokeWidth="0.5"
            />
            <line
              x1={CENTER}
              y1={0}
              x2={CENTER}
              y2={VIEWBOX}
              stroke="#1e293b"
              strokeWidth="0.5"
            />

            {/* Sweep cone */}
            <g transform={`rotate(${sweepAngle} ${CENTER} ${CENTER})`}>
              <path
                d={`M ${CENTER} ${CENTER} L ${CENTER + VIEWBOX / 2} ${CENTER - 40} A ${VIEWBOX / 2} ${VIEWBOX / 2} 0 0 1 ${CENTER + VIEWBOX / 2} ${CENTER + 40} Z`}
                fill="url(#sweep)"
              />
            </g>

            {/* Master agent / Mission Control */}
            <g>
              <circle
                cx={CENTER}
                cy={CENTER}
                r={60}
                fill="url(#master-glow)"
              />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={30}
                fill="#1e1b4b"
                stroke="#a855f7"
                strokeWidth="1.5"
              />
              <text
                x={CENTER}
                y={CENTER}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="22"
              >
                {master?.emoji ?? "🛰️"}
              </text>
              <text
                x={CENTER}
                y={CENTER + 48}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="11"
                fontFamily="ui-monospace, monospace"
              >
                {master?.displayName ?? "Mission Control"}
              </text>
            </g>

            {/* Pulses — rendered before blips so blips sit on top */}
            {pulses.map((pulse) => {
              const color = colorFor(pulse.status, pulse.kind);
              return (
                <g key={pulse.id}>
                  <circle
                    cx={pulse.position.x}
                    cy={pulse.position.y}
                    r={12}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.9"
                  >
                    <animate
                      attributeName="r"
                      from="12"
                      to="80"
                      dur={`${PULSE_DURATION_MS / 1000}s`}
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.9"
                      to="0"
                      dur={`${PULSE_DURATION_MS / 1000}s`}
                      fill="freeze"
                    />
                  </circle>
                </g>
              );
            })}

            {/* Agent blips */}
            {agents.map(({ agent, business, position }) => {
              const isSelected = agent.id === selectedAgentId;
              const recentlyPulsed = pulses.some(
                (p) => p.position.x === position.x && p.position.y === position.y
              );
              return (
                <g
                  key={agent.id}
                  onClick={() => handleBlipClick(agent.id)}
                  className="cursor-pointer"
                >
                  <title>{`${agent.displayName} — ${business.name}`}</title>
                  <circle
                    cx={position.x}
                    cy={position.y}
                    r={isSelected ? 20 : 14}
                    fill={isSelected ? "#22d3ee" : "#1e293b"}
                    stroke={recentlyPulsed ? "#f59e0b" : "#475569"}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  <text
                    x={position.x}
                    y={position.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isSelected ? 16 : 13}
                  >
                    {agent.emoji ?? "🤖"}
                  </text>
                  <text
                    x={position.x}
                    y={position.y + (isSelected ? 32 : 26)}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="ui-monospace, monospace"
                  >
                    {agent.displayName}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <aside className="hidden w-80 shrink-0 flex-col border-l border-ghost-border bg-ghost-base lg:flex">
        <div className="border-b border-ghost-border px-5 py-3 text-sm font-semibold text-white">
          {selectedAgent ? "Agent" : "Legend"}
        </div>
        {selectedAgent && selectedBusiness ? (
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ghost-raised text-2xl">
                {selectedAgent.emoji ?? "🤖"}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {selectedAgent.displayName}
                </div>
                <div className="text-xs text-slate-500">
                  {selectedAgent.role}
                </div>
              </div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="text-slate-500">Business</div>
              <div className="text-slate-200">{selectedBusiness.name}</div>
            </div>
            <div className="space-y-1 text-xs">
              <div className="text-slate-500">Type</div>
              <div className="text-slate-200">{selectedAgent.type}</div>
            </div>
            <div className="rounded-lg border border-ghost-border bg-ghost-raised/40 p-3 text-xs text-slate-400">
              Switch to the Feed tab and filter by this agent to see their
              full activity history.
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-xs">
            <div className="space-y-2">
              <div className="text-slate-500">Pulse color</div>
              <div className="space-y-1">
                <LegendRow color="#22d3ee" label="Chat / action run" />
                <LegendRow color="#f59e0b" label="Tool call" />
                <LegendRow color="#10b981" label="Completed" />
                <LegendRow color="#f43f5e" label="Failed" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-slate-500">How to read it</div>
              <p className="leading-5 text-slate-400">
                Each agent is a blip on the orbit of its business. When an
                event fires for an agent, a ripple pulses out from its blip.
                Click any blip to see details. The sweep is decorative — it
                doesn&apos;t drive updates.
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-slate-300">{label}</span>
    </div>
  );
}
