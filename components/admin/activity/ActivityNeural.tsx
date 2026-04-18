"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { tick, type ForceEdge, type ForceNode } from "@/lib/activity/force-layout";
import { cn } from "@/lib/utils";
import type {
  ActivityEvent,
  PulseAgent,
  PulseBusiness,
  PulseTopology
} from "@/components/admin/activity/types";

type ActivityNeuralProps = {
  topology: PulseTopology;
};

type NeuralNode = ForceNode & {
  kind: "master" | "business" | "agent";
  label: string;
  businessId?: string;
  agentType?: string;
  /** 0 for master, 1 for business, 2 for agent */
  depth: number;
};

type NeuralEdge = ForceEdge & {
  kind: "owns" | "contains";
  id: string;
};

type Firing = {
  id: string;
  bornAt: number;
  path: string[];
  color: string;
};

const POLL_INTERVAL_MS = 5000;
const FIRING_HOP_MS = 1500;

// Obsidian-ish palette — muted, desaturated, with color coding only where it helps
const COLORS = {
  bg: "#0b0f17",
  dotGrid: "#1a2234",
  edge: "#2a3548",
  edgeActive: "#7dd3fc",
  master: { fill: "#1e1b34", ring: "#a78bfa", glow: "#8b5cf6" },
  business: { fill: "#0f1a2b", ring: "#38bdf8", glow: "#0ea5e9" },
  agent: { fill: "#0f1520", ring: "#64748b", glow: "#475569" },
  labelDim: "#64748b",
  label: "#cbd5e1"
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

function buildGraph(topology: PulseTopology) {
  const nodes: NeuralNode[] = [];
  const edges: NeuralEdge[] = [];
  const masterId = topology.master?.id ?? "__root__";

  nodes.push({
    id: masterId,
    kind: "master",
    label: topology.master?.displayName ?? "Mission Control",
    depth: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0
  });

  topology.businesses.forEach((business, i) => {
    const businessCount = Math.max(topology.businesses.length, 1);
    const angle = (i / businessCount) * Math.PI * 2 - Math.PI / 2;
    const radius = 260;
    nodes.push({
      id: business.id,
      kind: "business",
      label: business.name,
      depth: 1,
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
      length: 220
    });

    business.agents.forEach((agent, j) => {
      const agentCount = Math.max(business.agents.length, 1);
      const spread = 0.7;
      const subAngle = angle + ((j / agentCount) - 0.5 + 0.5 / agentCount) * spread;
      const subRadius = radius + 170;
      nodes.push({
        id: agent.id,
        kind: "agent",
        label: agent.displayName,
        businessId: business.id,
        agentType: agent.type,
        depth: 2,
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
        length: 150
      });
    });
  });

  return { nodes, edges };
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

function NodeFill({ kind }: { kind: NeuralNode["kind"] }) {
  return kind === "master"
    ? COLORS.master.fill
    : kind === "business"
      ? COLORS.business.fill
      : COLORS.agent.fill;
}

function NodeRing({ kind }: { kind: NeuralNode["kind"] }) {
  return kind === "master"
    ? COLORS.master.ring
    : kind === "business"
      ? COLORS.business.ring
      : COLORS.agent.ring;
}

function NodeSize(kind: NeuralNode["kind"]) {
  return kind === "master" ? 14 : kind === "business" ? 11 : 8;
}

/**
 * Cubic bezier path between two points with a gentle outward curve. Creates
 * the flowing look that makes a graph feel more like a neural diagram than
 * an org chart.
 */
function edgePath(a: NeuralNode, b: NeuralNode) {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // Perpendicular offset for the curve's control points
  const perpX = -dy * 0.15;
  const perpY = dx * 0.15;
  const c1x = midX + perpX;
  const c1y = midY + perpY;
  return `M ${a.x} ${a.y} Q ${c1x} ${c1y} ${b.x} ${b.y}`;
}

/**
 * Parametric point along the quadratic bezier used in edgePath. Used to
 * animate a traveling pulse along the curve without requestAnimationFrame.
 */
function bezierPoint(a: NeuralNode, b: NeuralNode, t: number) {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const c1x = midX + -dy * 0.15;
  const c1y = midY + dx * 0.15;
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c1x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c1y + t * t * b.y
  };
}

export function ActivityNeural({ topology }: ActivityNeuralProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Seed the graph once per topology; the simulation state is mutable refs
  // so React re-renders don't thrash the physics.
  const graph = useMemo(() => buildGraph(topology), [topology]);
  const nodesRef = useRef<NeuralNode[]>(graph.nodes);
  const edgesRef = useRef<NeuralEdge[]>(graph.edges);
  const [tickCount, setTickCount] = useState(0);
  const firingsRef = useRef<Firing[]>([]);

  // Reset when topology changes
  useEffect(() => {
    nodesRef.current = graph.nodes;
    edgesRef.current = graph.edges;
    setTickCount(0);
  }, [graph]);

  // Computed inline on every render. The physics simulation mutates the
  // refs directly and bumps tickCount to trigger re-renders, so the indexes
  // would need to rebuild then anyway — useMemo with ref-based deps is a
  // hack ESLint rightly dislikes. Map of ~tens of nodes is cheap.
  void tickCount;
  const nodeIndex = new Map<string, NeuralNode>();
  for (const n of nodesRef.current) nodeIndex.set(n.id, n);
  const edgeIndex = new Map<string, NeuralEdge>();
  for (const e of edgesRef.current) edgeIndex.set(e.id, e);

  // Continuous force simulation. Runs while the component is mounted; cools
  // down naturally via the damping factor in the physics model.
  useEffect(() => {
    let raf = 0;
    const step = () => {
      tick(nodesRef.current, edgesRef.current, {
        repulsion: 26000,
        springStrength: 0.04,
        centering: 0.004,
        damping: 0.86
      });
      setTickCount((t) => t + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Viewport: scale + translate for pan/zoom
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewSize = useRef({ width: 1200, height: 800 });
  // Track drag state (for both node drag and canvas pan)
  const dragRef = useRef<
    | { kind: "node"; id: string; offsetX: number; offsetY: number }
    | { kind: "pan"; startX: number; startY: number; origPanX: number; origPanY: number }
    | null
  >(null);

  const screenToGraph = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const vw = viewSize.current.width;
      const vh = viewSize.current.height;
      // Map screen pixels into viewBox coordinates
      const svgX = ((clientX - rect.left) / rect.width) * vw;
      const svgY = ((clientY - rect.top) / rect.height) * vh;
      // Then undo the current pan + zoom
      return {
        x: (svgX - vw / 2 - pan.x) / scale,
        y: (svgY - vh / 2 - pan.y) / scale
      };
    },
    [pan, scale]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const target = e.target as Element;
      const nodeId = target.closest("[data-node-id]")?.getAttribute("data-node-id");
      if (nodeId) {
        const node = nodesRef.current.find((n) => n.id === nodeId);
        if (!node) return;
        const graphPt = screenToGraph(e.clientX, e.clientY);
        dragRef.current = {
          kind: "node",
          id: nodeId,
          offsetX: graphPt.x - node.x,
          offsetY: graphPt.y - node.y
        };
        node.fixed = true;
      } else {
        dragRef.current = {
          kind: "pan",
          startX: e.clientX,
          startY: e.clientY,
          origPanX: pan.x,
          origPanY: pan.y
        };
      }
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    },
    [pan.x, pan.y, screenToGraph]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.kind === "node") {
        const node = nodesRef.current.find((n) => n.id === drag.id);
        if (!node) return;
        const graphPt = screenToGraph(e.clientX, e.clientY);
        node.x = graphPt.x - drag.offsetX;
        node.y = graphPt.y - drag.offsetY;
        node.vx = 0;
        node.vy = 0;
      } else if (drag.kind === "pan") {
        setPan({
          x: drag.origPanX + (e.clientX - drag.startX),
          y: drag.origPanY + (e.clientY - drag.startY)
        });
      }
    },
    [screenToGraph]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (drag && drag.kind === "node") {
        const node = nodesRef.current.find((n) => n.id === drag.id);
        // Release the node back to the simulation after a small hold so it
        // drifts naturally if the user didn't actually move it.
        if (node) node.fixed = false;
      }
      dragRef.current = null;
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    },
    []
  );

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale((s) => Math.max(0.35, Math.min(2.8, s * factor)));
  }, []);

  const fitToView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Event stream → firings
  const newEvents = useEventStream(paused);
  const [, bumpRender] = useState(0);

  useEffect(() => {
    if (newEvents.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(false);
    const now = Date.now();
    const newFirings: Firing[] = [];
    for (const ev of newEvents) {
      if (!ev.agentId) continue;
      const agent = nodesRef.current.find((n) => n.id === ev.agentId);
      if (!agent || !agent.businessId) continue;
      const businessEdge = `e:${agent.businessId}->${agent.id}`;
      const masterEdge = edgesRef.current.find((e) => e.target === agent.businessId)?.id;
      const path = [businessEdge, masterEdge].filter(Boolean) as string[];
      newFirings.push({
        id: `${ev.id}:${now}`,
        bornAt: now,
        path,
        color: colorFor(ev.status, ev.kind)
      });
    }
    if (newFirings.length === 0) return;
    firingsRef.current = [...firingsRef.current, ...newFirings];
    // Evict after total animation length
    const total = FIRING_HOP_MS * 2 + 400;
    const t = setTimeout(() => {
      firingsRef.current = firingsRef.current.filter(
        (f) => Date.now() - f.bornAt < total
      );
      bumpRender((x) => x + 1);
    }, total);
    bumpRender((x) => x + 1);
    return () => clearTimeout(t);
  }, [newEvents]);

  // Determine focused set for dim/highlight treatment. Computed inline on
  // every render (edges are a small static list from the ref).
  const focusedId = hoveredNodeId ?? selectedNodeId;
  let focusedNeighborhood: { nodes: Set<string>; edges: Set<string> } | null = null;
  if (focusedId) {
    const neighbors = new Set<string>([focusedId]);
    const neighborEdges = new Set<string>();
    for (const edge of edgesRef.current) {
      if (edge.source === focusedId || edge.target === focusedId) {
        neighbors.add(edge.source);
        neighbors.add(edge.target);
        neighborEdges.add(edge.id);
      }
    }
    focusedNeighborhood = { nodes: neighbors, edges: neighborEdges };
  }

  const selectedNode = selectedNodeId
    ? nodesRef.current.find((n) => n.id === selectedNodeId) ?? null
    : null;
  const selectedBusiness: PulseBusiness | null = selectedNode
    ? selectedNode.kind === "business"
      ? topology.businesses.find((b) => b.id === selectedNode.id) ?? null
      : selectedNode.kind === "agent" && selectedNode.businessId
        ? topology.businesses.find((b) => b.id === selectedNode.businessId) ?? null
        : null
    : null;
  const selectedAgent: PulseAgent | null = selectedNode && selectedNode.kind === "agent"
    ? topology.businesses
        .flatMap((b) => b.agents)
        .find((a) => a.id === selectedNode.id) ?? null
    : null;

  return (
    <div className="flex h-full">
      <div className="relative flex min-w-0 flex-1 flex-col" style={{ background: COLORS.bg }}>
        <div
          className="flex items-center gap-3 border-b px-5 py-3"
          style={{ borderColor: COLORS.dotGrid }}
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
                className={cn(
                  "relative inline-flex h-2 w-2 rounded-full",
                  paused ? "bg-slate-500" : ""
                )}
                style={!paused ? { background: "#34d399" } : {}}
              />
            </span>
            {paused ? "Paused" : "Live"}
          </div>
          <div className="text-xs tracking-wide text-slate-500">
            {nodesRef.current.filter((n) => n.kind === "agent").length} agents ·{" "}
            {topology.businesses.length} businesses
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={fitToView}
              className="h-7 gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Fit
            </Button>
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

          <svg
            ref={svgRef}
            viewBox={`0 0 ${viewSize.current.width} ${viewSize.current.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full touch-none select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            style={{ cursor: dragRef.current?.kind === "pan" ? "grabbing" : "grab" }}
          >
            <defs>
              <pattern
                id="dot-grid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r="1" fill={COLORS.dotGrid} />
              </pattern>
              <radialGradient id="node-glow-master">
                <stop offset="0%" stopColor={COLORS.master.glow} stopOpacity="0.6" />
                <stop offset="100%" stopColor={COLORS.master.glow} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="node-glow-business">
                <stop offset="0%" stopColor={COLORS.business.glow} stopOpacity="0.45" />
                <stop offset="100%" stopColor={COLORS.business.glow} stopOpacity="0" />
              </radialGradient>
              <radialGradient id="node-glow-agent">
                <stop offset="0%" stopColor={COLORS.agent.glow} stopOpacity="0.35" />
                <stop offset="100%" stopColor={COLORS.agent.glow} stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect width="100%" height="100%" fill={COLORS.bg} />
            <rect width="100%" height="100%" fill="url(#dot-grid)" />

            <g
              transform={`translate(${viewSize.current.width / 2 + pan.x} ${viewSize.current.height / 2 + pan.y}) scale(${scale})`}
            >
              {/* Edges */}
              {edgesRef.current.map((edge) => {
                const a = nodeIndex.get(edge.source);
                const b = nodeIndex.get(edge.target);
                if (!a || !b) return null;
                const isActive = firingsRef.current.some((f) =>
                  f.path.includes(edge.id)
                );
                const isFocused = focusedNeighborhood
                  ? focusedNeighborhood.edges.has(edge.id)
                  : false;
                const dimmed = focusedNeighborhood && !isFocused;
                const stroke = isActive
                  ? COLORS.edgeActive
                  : isFocused
                    ? "#475569"
                    : COLORS.edge;
                return (
                  <path
                    key={edge.id}
                    d={edgePath(a, b)}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isActive ? 1.4 : isFocused ? 1.2 : 0.9}
                    opacity={dimmed ? 0.15 : isActive ? 0.9 : 0.7}
                    style={{ transition: "opacity 180ms, stroke 180ms" }}
                  />
                );
              })}

              {/* Traveling pulses — one orb per hop in the path, staggered */}
              {firingsRef.current.flatMap((firing) =>
                firing.path.map((edgeId, hopIndex) => {
                  const edge = edgeIndex.get(edgeId);
                  if (!edge) return null;
                  const parent = nodeIndex.get(edge.source);
                  const child = nodeIndex.get(edge.target);
                  if (!parent || !child) return null;
                  // Pulse travels from child inward toward parent
                  const steps = 16;
                  const delayMs = hopIndex * (FIRING_HOP_MS * 0.85);
                  return (
                    <g key={`${firing.id}-${hopIndex}`}>
                      <circle r="3.5" fill={firing.color}>
                        <animateMotion
                          dur={`${FIRING_HOP_MS / 1000}s`}
                          begin={`${delayMs / 1000}s`}
                          fill="freeze"
                          path={Array.from({ length: steps + 1 }, (_, i) => {
                            const t = 1 - i / steps;
                            const pt = bezierPoint(parent, child, t);
                            return i === 0
                              ? `M ${pt.x} ${pt.y}`
                              : `L ${pt.x} ${pt.y}`;
                          }).join(" ")}
                        />
                        <animate
                          attributeName="opacity"
                          values="0;1;1;0"
                          keyTimes="0;0.15;0.85;1"
                          dur={`${FIRING_HOP_MS / 1000}s`}
                          begin={`${delayMs / 1000}s`}
                          fill="freeze"
                        />
                      </circle>
                    </g>
                  );
                })
              )}

              {/* Nodes */}
              {nodesRef.current.map((node) => {
                const isSelected = node.id === selectedNodeId;
                const isHovered = node.id === hoveredNodeId;
                const isFocused = focusedNeighborhood?.nodes.has(node.id) ?? false;
                const dimmed = focusedNeighborhood && !isFocused;
                const r = NodeSize(node.kind);
                const ring = NodeRing({ kind: node.kind });
                const fill = NodeFill({ kind: node.kind });
                const recentlyFired = firingsRef.current.some((f) =>
                  f.path.some((edgeId) => edgeId.endsWith(`->${node.id}`))
                );
                const glowId =
                  node.kind === "master"
                    ? "node-glow-master"
                    : node.kind === "business"
                      ? "node-glow-business"
                      : "node-glow-agent";
                return (
                  <g
                    key={node.id}
                    data-node-id={node.id}
                    onClick={() =>
                      setSelectedNodeId((id) => (id === node.id ? null : node.id))
                    }
                    onPointerEnter={() => setHoveredNodeId(node.id)}
                    onPointerLeave={() =>
                      setHoveredNodeId((id) => (id === node.id ? null : id))
                    }
                    style={{
                      opacity: dimmed ? 0.25 : 1,
                      transition: "opacity 180ms"
                    }}
                  >
                    {(isHovered || isSelected || recentlyFired) ? (
                      <circle cx={node.x} cy={node.y} r={r * 3.5} fill={`url(#${glowId})`} />
                    ) : null}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r}
                      fill={fill}
                      stroke={ring}
                      strokeWidth={isSelected ? 2 : isHovered ? 1.6 : 1.2}
                      style={{ cursor: "pointer", transition: "r 160ms, stroke-width 160ms" }}
                    />
                    <text
                      x={node.x}
                      y={node.y + r + 14}
                      textAnchor="middle"
                      fontSize="9"
                      fontFamily="'Inter', ui-sans-serif, system-ui, sans-serif"
                      fontWeight={isFocused || isHovered || isSelected ? 500 : 400}
                      fill={
                        dimmed
                          ? COLORS.labelDim
                          : isHovered || isSelected
                            ? "#f8fafc"
                            : COLORS.label
                      }
                      style={{
                        letterSpacing: "0.02em",
                        pointerEvents: "none"
                      }}
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-md border bg-black/40 px-3 py-2 text-[10px] text-slate-400 backdrop-blur"
            style={{ borderColor: COLORS.dotGrid }}
          >
            <span>drag nodes · drag canvas to pan · scroll to zoom</span>
          </div>
        </div>
      </div>

      <aside
        className="hidden w-80 shrink-0 flex-col border-l lg:flex"
        style={{ borderColor: COLORS.dotGrid, background: "#080c14" }}
      >
        <div
          className="border-b px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400"
          style={{ borderColor: COLORS.dotGrid }}
        >
          {selectedNode ? selectedNode.kind : "Neural Map"}
        </div>
        {selectedNode ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div className="space-y-1">
              <div
                className="inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
                style={{
                  background: `${NodeRing({ kind: selectedNode.kind })}1a`,
                  color: NodeRing({ kind: selectedNode.kind })
                }}
              >
                {selectedNode.kind}
              </div>
              <div className="text-lg font-semibold text-white">
                {selectedNode.label}
              </div>
            </div>
            {selectedAgent ? (
              <>
                <FieldRow label="Role" value={selectedAgent.role} />
                <FieldRow label="Type" value={selectedAgent.type} />
              </>
            ) : null}
            {selectedBusiness ? (
              <FieldRow label="Business" value={selectedBusiness.name} />
            ) : null}
            <div
              className="rounded-md border p-3 text-xs leading-5 text-slate-400"
              style={{ borderColor: COLORS.dotGrid, background: "#0b1220" }}
            >
              Switch to the Feed tab and filter by this node to see its full
              event history with error details and metadata.
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-xs">
            <div className="space-y-2">
              <Header>How to read it</Header>
              <p className="leading-5 text-slate-400">
                Each agent is a node, each business is a hub, and Mission
                Control sits at the center. Edges show ownership. When an agent
                does something, a pulse travels inward — agent to business to
                Mission Control — colored by what happened.
              </p>
            </div>
            <div className="space-y-2">
              <Header>Nodes</Header>
              <LegendRow color={COLORS.master.ring} label="Master" />
              <LegendRow color={COLORS.business.ring} label="Business" />
              <LegendRow color={COLORS.agent.ring} label="Agent" />
            </div>
            <div className="space-y-2">
              <Header>Signal</Header>
              <LegendRow color={STATUS_COLOR.default} label="Chat / action" />
              <LegendRow color="#fbbf24" label="Tool call" />
              <LegendRow color={STATUS_COLOR.completed} label="Completed" />
              <LegendRow color={STATUS_COLOR.failed} label="Failed" />
            </div>
            <div className="space-y-2">
              <Header>Controls</Header>
              <div className="space-y-1 leading-5 text-slate-400">
                <div>Drag a node to reposition</div>
                <div>Drag empty canvas to pan</div>
                <div>Scroll to zoom · Fit to reset</div>
                <div>Hover a node to highlight neighborhood</div>
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
