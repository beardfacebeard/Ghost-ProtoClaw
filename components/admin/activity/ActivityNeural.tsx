"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { settle, type ForceEdge, type ForceNode } from "@/lib/activity/force-layout";
import { cn } from "@/lib/utils";
import type {
  ActivityEvent,
  PulseBusiness,
  PulseTopology
} from "@/components/admin/activity/types";

type ActivityNeuralProps = {
  topology: PulseTopology;
};

type NeuralNode = ForceNode & {
  kind: "master" | "business" | "agent";
  label: string;
  emoji: string | null;
  businessId?: string;
  agentType?: string;
};

type NeuralEdge = ForceEdge & {
  kind: "owns" | "contains";
  id: string;
};

type Firing = {
  id: string;
  eventId: string;
  /** Sequence of edge ids the pulse travels along. */
  path: string[];
  status: string | null;
  kind: string;
  bornAt: number;
};

const VIEWBOX = 900;
const CENTER = VIEWBOX / 2;
const POLL_INTERVAL_MS = 5000;
const FIRING_DURATION_MS = 1800;

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
  return STATUS_COLOR.default;
}

/**
 * Build the graph from the topology: one master node (or a virtual root when
 * no master is provisioned), a node per business, and a node per agent.
 * Edges connect master → business and business → agent. Pre-settle the
 * layout with a couple hundred force-sim iterations so the initial render
 * is stable — we don't keep the simulation running after mount.
 */
function buildGraph(topology: PulseTopology) {
  const nodes: NeuralNode[] = [];
  const edges: NeuralEdge[] = [];

  const masterId = topology.master?.id ?? "__root__";
  nodes.push({
    id: masterId,
    kind: "master",
    label: topology.master?.displayName ?? "Mission Control",
    emoji: topology.master?.emoji ?? "🛰️",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fixed: true
  });

  topology.businesses.forEach((business, i) => {
    const angle = (i / Math.max(topology.businesses.length, 1)) * Math.PI * 2;
    const radius = 220;
    nodes.push({
      id: business.id,
      kind: "business",
      label: business.name,
      emoji: "🏢",
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0
    });
    edges.push({
      id: `e:${masterId}->${business.id}`,
      source: masterId,
      target: business.id,
      kind: "owns",
      length: 200
    });

    business.agents.forEach((agent, j) => {
      const subAngle =
        angle + ((j / Math.max(business.agents.length, 1) - 0.5) * 0.8);
      const subRadius = radius + 160;
      nodes.push({
        id: agent.id,
        kind: "agent",
        label: agent.displayName,
        emoji: agent.emoji,
        businessId: business.id,
        agentType: agent.type,
        x: Math.cos(subAngle) * subRadius,
        y: Math.sin(subAngle) * subRadius,
        vx: 0,
        vy: 0
      });
      edges.push({
        id: `e:${business.id}->${agent.id}`,
        source: business.id,
        target: agent.id,
        kind: "contains",
        length: 130
      });
    });
  });

  // Pre-settle the layout
  settle(nodes, edges, 240, {
    repulsion: 22000,
    springStrength: 0.045,
    centering: 0.006,
    damping: 0.8
  });

  return { nodes, edges };
}

/** Polling hook — shared shape with the radar. Only returns events newer than the last seen timestamp. */
function useNewEventStream(paused: boolean) {
  const [latestEvents, setLatestEvents] = useState<ActivityEvent[]>([]);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    if (paused) return;
    let cancelled = false;

    const seed = async () => {
      try {
        const res = await fetch(`/api/admin/activity/stream?limit=1`, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = (await res.json()) as { serverTime: string };
        lastSeenRef.current = data.serverTime;
      } catch {
        // next tick will retry
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
          setLatestEvents(data.events);
          lastSeenRef.current = data.events[0].createdAt;
        } else if (!lastSeenRef.current) {
          lastSeenRef.current = data.serverTime;
        }
      } catch {
        // ignore
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

export function ActivityNeural({ topology }: ActivityNeuralProps) {
  const [paused, setPaused] = useState(false);
  const [firings, setFirings] = useState<Firing[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { nodes, edges } = useMemo(() => buildGraph(topology), [topology]);

  const nodeIndex = useMemo(() => {
    const map = new Map<string, NeuralNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const edgeIndex = useMemo(() => {
    const map = new Map<string, NeuralEdge>();
    for (const edge of edges) map.set(edge.id, edge);
    return map;
  }, [edges]);

  // Compute view transform: fit all nodes into the viewbox with padding.
  const transform = useMemo(() => {
    if (nodes.length === 0) return { scale: 1, tx: 0, ty: 0 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }
    const pad = 80;
    const w = Math.max(maxX - minX, 1) + pad * 2;
    const h = Math.max(maxY - minY, 1) + pad * 2;
    const scale = Math.min(VIEWBOX / w, VIEWBOX / h);
    const tx = -minX * scale + pad * scale + (VIEWBOX - (maxX - minX) * scale - pad * 2 * scale) / 2;
    const ty = -minY * scale + pad * scale + (VIEWBOX - (maxY - minY) * scale - pad * 2 * scale) / 2;
    return { scale, tx, ty };
  }, [nodes]);

  const newEvents = useNewEventStream(paused);

  useEffect(() => {
    if (newEvents.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(false);
    const now = Date.now();
    const fresh: Firing[] = [];

    for (const event of newEvents) {
      if (!event.agentId) continue;
      const agentNode = nodeIndex.get(event.agentId);
      if (!agentNode) continue;
      const businessEdgeId = `e:${agentNode.businessId}->${event.agentId}`;
      if (!edgeIndex.has(businessEdgeId)) continue;
      const businessToMasterEdgeId = Array.from(edgeIndex.keys()).find(
        (id) => id.endsWith(`->${agentNode.businessId}`)
      );
      const path = businessToMasterEdgeId
        ? [businessEdgeId, businessToMasterEdgeId]
        : [businessEdgeId];
      fresh.push({
        id: `${event.id}:${now}`,
        eventId: event.id,
        path,
        status: event.status,
        kind: event.kind,
        bornAt: now
      });
    }

    if (fresh.length === 0) return;
    setFirings((prev) => [...prev, ...fresh]);

    const timer = setTimeout(() => {
      setFirings((prev) =>
        prev.filter((f) => Date.now() - f.bornAt < FIRING_DURATION_MS * 2)
      );
    }, FIRING_DURATION_MS * 2 + 200);
    return () => clearTimeout(timer);
  }, [newEvents, nodeIndex, edgeIndex]);

  const handleNodeClick = useCallback(
    (id: string) => setSelectedNodeId((cur) => (cur === id ? null : id)),
    []
  );

  const selectedNode = selectedNodeId ? nodeIndex.get(selectedNodeId) ?? null : null;
  const selectedBusiness: PulseBusiness | null = selectedNode
    ? selectedNode.kind === "business"
      ? topology.businesses.find((b) => b.id === selectedNode.id) ?? null
      : selectedNode.kind === "agent" && selectedNode.businessId
        ? topology.businesses.find((b) => b.id === selectedNode.businessId) ?? null
        : null
    : null;

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
            {paused ? "Paused" : "Live"}
          </div>
          <div className="text-xs text-slate-500">
            {nodes.filter((n) => n.kind === "agent").length} agents ·{" "}
            {topology.businesses.length} businesses · {edges.length} connections
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

          {nodes.length <= 1 ? (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-slate-500">
              No agents in the graph yet. Add a business and some agents to see
              the connections come alive.
            </div>
          ) : null}

          <svg
            viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="neural-bg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0a1020" stopOpacity="1" />
                <stop offset="100%" stopColor="#030610" stopOpacity="1" />
              </radialGradient>
              <radialGradient id="neural-node-glow">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect
              x="0"
              y="0"
              width={VIEWBOX}
              height={VIEWBOX}
              fill="url(#neural-bg)"
            />

            <g
              transform={`translate(${transform.tx} ${transform.ty}) scale(${transform.scale})`}
            >
              {/* Edges */}
              {edges.map((edge) => {
                const a = nodeIndex.get(edge.source);
                const b = nodeIndex.get(edge.target);
                if (!a || !b) return null;
                const active = firings.some((f) => f.path.includes(edge.id));
                return (
                  <line
                    key={edge.id}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={active ? "#22d3ee" : "#1e293b"}
                    strokeWidth={active ? 2 : 1}
                    opacity={active ? 0.9 : 0.6}
                  />
                );
              })}

              {/* Traveling pulses — one dot per hop in the path, sequentially */}
              {firings.map((firing) => {
                return firing.path.map((edgeId, hopIndex) => {
                  const edge = edgeIndex.get(edgeId);
                  if (!edge) return null;
                  const a = nodeIndex.get(edge.source);
                  const b = nodeIndex.get(edge.target);
                  if (!a || !b) return null;
                  // Hop direction: for agent firings, the pulse travels INWARD
                  // (agent → business → master). Our edges go source=parent to
                  // target=child, so we want to animate b → a.
                  const startX = b.x;
                  const startY = b.y;
                  const endX = a.x;
                  const endY = a.y;
                  const color = colorFor(firing.status, firing.kind);
                  const hopDurMs = FIRING_DURATION_MS;
                  const delayMs = hopIndex * (hopDurMs * 0.8);
                  return (
                    <circle
                      key={`${firing.id}-${hopIndex}`}
                      cx={startX}
                      cy={startY}
                      r={6}
                      fill={color}
                      opacity="0.95"
                    >
                      <animate
                        attributeName="cx"
                        from={startX}
                        to={endX}
                        dur={`${hopDurMs / 1000}s`}
                        begin={`${delayMs / 1000}s`}
                        fill="freeze"
                      />
                      <animate
                        attributeName="cy"
                        from={startY}
                        to={endY}
                        dur={`${hopDurMs / 1000}s`}
                        begin={`${delayMs / 1000}s`}
                        fill="freeze"
                      />
                      <animate
                        attributeName="opacity"
                        values="0;0.95;0.95;0"
                        keyTimes="0;0.1;0.8;1"
                        dur={`${hopDurMs / 1000}s`}
                        begin={`${delayMs / 1000}s`}
                        fill="freeze"
                      />
                    </circle>
                  );
                });
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const isSelected = node.id === selectedNodeId;
                const wasFiring = firings.some((f) =>
                  f.path.some((edgeId) => edgeId.endsWith(`->${node.id}`))
                );
                const size =
                  node.kind === "master"
                    ? 34
                    : node.kind === "business"
                      ? 24
                      : 18;
                const ringColor =
                  node.kind === "master"
                    ? "#a855f7"
                    : node.kind === "business"
                      ? "#22d3ee"
                      : "#64748b";
                return (
                  <g
                    key={node.id}
                    onClick={() => handleNodeClick(node.id)}
                    className="cursor-pointer"
                  >
                    <title>{node.label}</title>
                    {wasFiring ? (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={size + 8}
                        fill="url(#neural-node-glow)"
                      />
                    ) : null}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={size}
                      fill={isSelected ? "#0f172a" : "#1e293b"}
                      stroke={ringColor}
                      strokeWidth={isSelected ? 2 : 1.2}
                    />
                    <text
                      x={node.x}
                      y={node.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={size * 0.85}
                    >
                      {node.emoji ?? "🤖"}
                    </text>
                    <text
                      x={node.x}
                      y={node.y + size + 14}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="11"
                      fontFamily="ui-monospace, monospace"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      <aside className="hidden w-80 shrink-0 flex-col border-l border-ghost-border bg-ghost-base lg:flex">
        <div className="border-b border-ghost-border px-5 py-3 text-sm font-semibold text-white">
          {selectedNode ? "Node" : "Neural Map"}
        </div>
        {selectedNode ? (
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ghost-raised text-2xl">
                {selectedNode.emoji ?? "🤖"}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {selectedNode.label}
                </div>
                <div className="text-xs capitalize text-slate-500">
                  {selectedNode.kind}
                </div>
              </div>
            </div>
            {selectedNode.agentType ? (
              <div className="space-y-1 text-xs">
                <div className="text-slate-500">Agent type</div>
                <div className="text-slate-200">{selectedNode.agentType}</div>
              </div>
            ) : null}
            {selectedBusiness ? (
              <div className="space-y-1 text-xs">
                <div className="text-slate-500">Business</div>
                <div className="text-slate-200">{selectedBusiness.name}</div>
              </div>
            ) : null}
            <div className="rounded-lg border border-ghost-border bg-ghost-raised/40 p-3 text-xs text-slate-400">
              Switch to the Feed tab to see this node&apos;s full event history.
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-xs">
            <div className="space-y-1">
              <div className="text-slate-500">How to read it</div>
              <p className="leading-5 text-slate-400">
                Nodes are agents, businesses, and your master agent at the
                hub. Edges connect them by ownership. When an agent does
                something, a dot fires down the edge toward the business, then
                toward Mission Control — the system&apos;s activity as signal
                propagation.
              </p>
            </div>
            <div className="space-y-1">
              <div className="text-slate-500">Node colors</div>
              <div className="space-y-1">
                <LegendRow color="#a855f7" label="Master" />
                <LegendRow color="#22d3ee" label="Business" />
                <LegendRow color="#64748b" label="Agent" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-slate-500">Signal colors</div>
              <div className="space-y-1">
                <LegendRow color="#22d3ee" label="Chat / action" />
                <LegendRow color="#f59e0b" label="Tool call" />
                <LegendRow color="#10b981" label="Completed" />
                <LegendRow color="#f43f5e" label="Failed" />
              </div>
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
