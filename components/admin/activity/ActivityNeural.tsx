"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
};

type NeuralEdge = ForceEdge & {
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
const DRAG_THRESHOLD_PX = 4;
const CLICK_MAX_MS = 260;

const COLORS = {
  bg: "#0a0e17",
  bgDeep: "#050811",
  dotGrid: "#121a2a",
  edge: "#243046",
  edgeActive: "#7dd3fc",
  label: "#cbd5e1",
  labelDim: "#475569",
  labelStrong: "#f8fafc"
};

// Spherical-feel gradient definitions (light source upper-left) per node kind.
// Each produces a 3D-looking orb via a radialGradient + rim highlight.
const NODE_GRADIENTS = {
  master: {
    top: "#e9d5ff",
    mid: "#a855f7",
    deep: "#4c1d95",
    ring: "#c4b5fd",
    glow: "#8b5cf6"
  },
  business: {
    top: "#bae6fd",
    mid: "#38bdf8",
    deep: "#0c4a6e",
    ring: "#7dd3fc",
    glow: "#0ea5e9"
  },
  agent: {
    top: "#cbd5e1",
    mid: "#64748b",
    deep: "#1e293b",
    ring: "#94a3b8",
    glow: "#475569"
  }
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

function nodeRadius(kind: NeuralNode["kind"]) {
  return kind === "master" ? 22 : kind === "business" ? 16 : 12;
}

function buildGraph(topology: PulseTopology) {
  const nodes: NeuralNode[] = [];
  const edges: NeuralEdge[] = [];
  const masterId = topology.master?.id ?? "__root__";

  nodes.push({
    id: masterId,
    kind: "master",
    label: topology.master?.displayName ?? "Mission Control",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0
  });

  topology.businesses.forEach((business, i) => {
    const businessCount = Math.max(topology.businesses.length, 1);
    const angle = (i / businessCount) * Math.PI * 2 - Math.PI / 2;
    const radius = 280;
    nodes.push({
      id: business.id,
      kind: "business",
      label: business.name,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0
    });
    edges.push({
      id: `e:${masterId}->${business.id}`,
      source: masterId,
      target: business.id,
      length: 240
    });

    business.agents.forEach((agent, j) => {
      const agentCount = Math.max(business.agents.length, 1);
      const spread = Math.min(1.4, 0.2 + agentCount * 0.12);
      const subAngle =
        angle + ((j / agentCount) - 0.5 + 0.5 / agentCount) * spread;
      const subRadius = radius + 200;
      nodes.push({
        id: agent.id,
        kind: "agent",
        label: agent.displayName,
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
        length: 170
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
        /* retry */
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

/**
 * Fetch a specific node's recent activity. Used by the sidebar when a node
 * is selected so the user can see "what has this agent actually been doing
 * lately?" without leaving the graph.
 */
function useNodeHistory(
  node: NeuralNode | null,
  refreshTick: number
): {
  events: ActivityEvent[];
  loading: boolean;
  stats: { total: number; failed: number; completed: number };
} {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!node) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set("limit", "25");
    if (node.kind === "agent") qs.set("agentId", node.id);
    else if (node.kind === "business") qs.set("businessId", node.id);
    // master node: no filter — show org-wide recent activity
    (async () => {
      try {
        const res = await fetch(`/api/admin/activity/stream?${qs}`, {
          cache: "no-store"
        });
        if (!res.ok) return;
        const data = (await res.json()) as { events: ActivityEvent[] };
        if (cancelled) return;
        setEvents(data.events ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [node, refreshTick]);

  const failed = events.filter(
    (e) => e.status === "failed" || e.status === "error"
  ).length;
  const completed = events.filter((e) => e.status === "completed").length;

  return {
    events,
    loading,
    stats: { total: events.length, failed, completed }
  };
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function edgePath(a: NeuralNode, b: NeuralNode) {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const perpX = -dy * 0.15;
  const perpY = dx * 0.15;
  return `M ${a.x} ${a.y} Q ${midX + perpX} ${midY + perpY} ${b.x} ${b.y}`;
}

function bezierPoint(a: NeuralNode, b: NeuralNode, t: number) {
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = midX + -dy * 0.15;
  const cy = midY + dx * 0.15;
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
    y: u * u * a.y + 2 * u * t * cy + t * t * b.y
  };
}

export function ActivityNeural({ topology }: ActivityNeuralProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyTick, setHistoryTick] = useState(0);

  const nodesRef = useRef<NeuralNode[]>([]);
  const edgesRef = useRef<NeuralEdge[]>([]);
  const firingsRef = useRef<Firing[]>([]);
  const [renderTick, setRenderTick] = useState(0);

  // (Re)build graph when topology changes
  useEffect(() => {
    const g = buildGraph(topology);
    nodesRef.current = g.nodes;
    edgesRef.current = g.edges;
    setRenderTick((t) => t + 1);
  }, [topology]);

  // Continuous force simulation
  useEffect(() => {
    let raf = 0;
    const step = () => {
      tick(nodesRef.current, edgesRef.current, {
        repulsion: 32000,
        springStrength: 0.04,
        centering: 0.003,
        damping: 0.86
      });
      setRenderTick((t) => t + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Pan + zoom state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewSize = useRef({ width: 1400, height: 900 });

  // Pointer interaction state (click vs drag disambiguation)
  const pointerRef = useRef<
    | {
        kind: "node";
        id: string;
        startX: number;
        startY: number;
        startedAt: number;
        offsetX: number;
        offsetY: number;
        moved: boolean;
      }
    | {
        kind: "pan";
        startX: number;
        startY: number;
        origPanX: number;
        origPanY: number;
        moved: boolean;
        startedAt: number;
      }
    | null
  >(null);

  const screenToGraph = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const vw = viewSize.current.width;
      const vh = viewSize.current.height;
      const svgX = ((clientX - rect.left) / rect.width) * vw;
      const svgY = ((clientY - rect.top) / rect.height) * vh;
      return {
        x: (svgX - vw / 2 - pan.x) / scale,
        y: (svgY - vh / 2 - pan.y) / scale
      };
    },
    [pan, scale]
  );

  // ensure nodeIndex rebuild happens on every render via renderTick dependency
  void renderTick;
  const nodeIndex = new Map<string, NeuralNode>();
  for (const n of nodesRef.current) nodeIndex.set(n.id, n);
  const edgeIndex = new Map<string, NeuralEdge>();
  for (const e of edgesRef.current) edgeIndex.set(e.id, e);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const target = e.target as Element;
      const nodeId = target
        .closest("[data-node-id]")
        ?.getAttribute("data-node-id");
      const now = performance.now();
      if (nodeId) {
        const node = nodesRef.current.find((n) => n.id === nodeId);
        if (!node) return;
        const graphPt = screenToGraph(e.clientX, e.clientY);
        pointerRef.current = {
          kind: "node",
          id: nodeId,
          startX: e.clientX,
          startY: e.clientY,
          startedAt: now,
          offsetX: graphPt.x - node.x,
          offsetY: graphPt.y - node.y,
          moved: false
        };
      } else {
        pointerRef.current = {
          kind: "pan",
          startX: e.clientX,
          startY: e.clientY,
          origPanX: pan.x,
          origPanY: pan.y,
          moved: false,
          startedAt: now
        };
      }
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [pan.x, pan.y, screenToGraph]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = pointerRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        drag.moved = true;
        if (drag.kind === "node") {
          const node = nodesRef.current.find((n) => n.id === drag.id);
          if (node) node.fixed = true;
        }
      }
      if (!drag.moved) return;
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
          x: drag.origPanX + dx,
          y: drag.origPanY + dy
        });
      }
    },
    [screenToGraph]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = pointerRef.current;
      if (!drag) return;
      const elapsed = performance.now() - drag.startedAt;
      const wasClick = !drag.moved && elapsed < CLICK_MAX_MS;

      if (drag.kind === "node") {
        const node = nodesRef.current.find((n) => n.id === drag.id);
        if (node) node.fixed = false;
        if (wasClick) {
          setSelectedNodeId((id) => (id === drag.id ? null : drag.id));
          setHistoryTick((t) => t + 1);
        }
      } else if (drag.kind === "pan" && wasClick) {
        // Click on empty space: dismiss selection
        setSelectedNodeId(null);
      }

      pointerRef.current = null;
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    []
  );

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale((s) => Math.max(0.35, Math.min(3, s * factor)));
  }, []);

  const fitToView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Live events → firings
  const newEvents = useEventStream(paused);
  useEffect(() => {
    if (newEvents.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(false);
    const now = Date.now();
    const fresh: Firing[] = [];
    for (const ev of newEvents) {
      if (!ev.agentId) continue;
      const agentNode = nodesRef.current.find((n) => n.id === ev.agentId);
      if (!agentNode || !agentNode.businessId) continue;
      const agentEdge = `e:${agentNode.businessId}->${agentNode.id}`;
      const masterEdge = edgesRef.current.find(
        (e) => e.target === agentNode.businessId
      )?.id;
      const path = [agentEdge, masterEdge].filter(Boolean) as string[];
      fresh.push({
        id: `${ev.id}:${now}`,
        bornAt: now,
        path,
        color: colorFor(ev.status, ev.kind)
      });
    }
    if (fresh.length === 0) return;
    firingsRef.current = [...firingsRef.current, ...fresh];
    setRenderTick((t) => t + 1);
    // Also nudge the sidebar to refetch if the selection is affected
    setHistoryTick((t) => t + 1);
    const total = FIRING_HOP_MS * 2 + 400;
    const timer = setTimeout(() => {
      firingsRef.current = firingsRef.current.filter(
        (f) => Date.now() - f.bornAt < total
      );
      setRenderTick((t) => t + 1);
    }, total);
    return () => clearTimeout(timer);
  }, [newEvents]);

  const focusedId = hoveredNodeId ?? selectedNodeId;
  let focusedNeighborhood: { nodes: Set<string>; edges: Set<string> } | null =
    null;
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
        ? topology.businesses.find((b) => b.id === selectedNode.businessId) ??
          null
        : null
    : null;
  const selectedAgent: PulseAgent | null =
    selectedNode && selectedNode.kind === "agent"
      ? topology.businesses
          .flatMap((b) => b.agents)
          .find((a) => a.id === selectedNode.id) ?? null
      : null;

  const nodeHistory = useNodeHistory(selectedNode, historyTick);

  return (
    <div className="flex h-full">
      <div
        className="relative flex min-w-0 flex-1 flex-col"
        style={{ background: COLORS.bg }}
      >
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
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: paused ? "#475569" : "#34d399" }}
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
                  <Play className="h-3.5 w-3.5" /> Resume
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
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
            style={{ cursor: pointerRef.current ? "grabbing" : "grab" }}
          >
            <defs>
              {/* Spherical gradient + rim highlight per node kind */}
              {(Object.keys(NODE_GRADIENTS) as Array<keyof typeof NODE_GRADIENTS>).map((kind) => {
                const g = NODE_GRADIENTS[kind];
                return (
                  <g key={kind}>
                    <radialGradient
                      id={`sphere-${kind}`}
                      cx="32%"
                      cy="28%"
                      r="72%"
                    >
                      <stop offset="0%" stopColor={g.top} stopOpacity="0.95" />
                      <stop offset="55%" stopColor={g.mid} stopOpacity="0.95" />
                      <stop offset="100%" stopColor={g.deep} stopOpacity="1" />
                    </radialGradient>
                    <radialGradient
                      id={`glow-${kind}`}
                      cx="50%"
                      cy="50%"
                      r="50%"
                    >
                      <stop offset="0%" stopColor={g.glow} stopOpacity="0.55" />
                      <stop offset="100%" stopColor={g.glow} stopOpacity="0" />
                    </radialGradient>
                  </g>
                );
              })}

              {/* Background dot grid */}
              <pattern
                id="neural-dots"
                width="28"
                height="28"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r="1" fill={COLORS.dotGrid} />
              </pattern>

              {/* Background radial vignette */}
              <radialGradient id="neural-bg" cx="50%" cy="50%" r="72%">
                <stop offset="0%" stopColor="#0e1424" stopOpacity="1" />
                <stop offset="100%" stopColor={COLORS.bgDeep} stopOpacity="1" />
              </radialGradient>

              {/* Subtle soft-blur filter for ambient glow (kept conservative
                  to not tank perf on older GPUs). */}
              <filter id="soft-glow">
                <feGaussianBlur stdDeviation="4" />
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#neural-bg)" />
            <rect
              width="100%"
              height="100%"
              fill="url(#neural-dots)"
              opacity="0.5"
            />

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
                const inFocus = focusedNeighborhood?.edges.has(edge.id) ?? false;
                const dimmed = focusedNeighborhood && !inFocus;
                return (
                  <path
                    key={edge.id}
                    d={edgePath(a, b)}
                    fill="none"
                    stroke={
                      isActive
                        ? COLORS.edgeActive
                        : inFocus
                          ? "#475569"
                          : COLORS.edge
                    }
                    strokeWidth={isActive ? 1.6 : inFocus ? 1.3 : 0.9}
                    opacity={dimmed ? 0.12 : isActive ? 0.95 : 0.7}
                    style={{ transition: "opacity 180ms, stroke 180ms" }}
                  />
                );
              })}

              {/* Traveling signals along curved edges */}
              {firingsRef.current.flatMap((firing) =>
                firing.path.map((edgeId, hopIndex) => {
                  const edge = edgeIndex.get(edgeId);
                  if (!edge) return null;
                  const parent = nodeIndex.get(edge.source);
                  const child = nodeIndex.get(edge.target);
                  if (!parent || !child) return null;
                  const steps = 18;
                  const delayMs = hopIndex * (FIRING_HOP_MS * 0.85);
                  const pathData = Array.from({ length: steps + 1 }, (_, i) => {
                    const t = 1 - i / steps;
                    const pt = bezierPoint(parent, child, t);
                    return i === 0
                      ? `M ${pt.x} ${pt.y}`
                      : `L ${pt.x} ${pt.y}`;
                  }).join(" ");
                  return (
                    <g key={`${firing.id}-${hopIndex}`}>
                      <circle r="4" fill={firing.color}>
                        <animateMotion
                          dur={`${FIRING_HOP_MS / 1000}s`}
                          begin={`${delayMs / 1000}s`}
                          fill="freeze"
                          path={pathData}
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

              {/* Nodes — spherical, with soft glow */}
              {nodesRef.current.map((node) => {
                const isSelected = node.id === selectedNodeId;
                const isHovered = node.id === hoveredNodeId;
                const inFocus =
                  focusedNeighborhood?.nodes.has(node.id) ?? false;
                const dimmed = focusedNeighborhood && !inFocus;
                const r = nodeRadius(node.kind);
                const grad = NODE_GRADIENTS[node.kind];
                const recentlyFired = firingsRef.current.some((f) =>
                  f.path.some((id) => id.endsWith(`->${node.id}`))
                );
                const isEmphasized = isHovered || isSelected || recentlyFired;
                const scale = isSelected ? 1.18 : isHovered ? 1.08 : 1;

                return (
                  <g
                    key={node.id}
                    data-node-id={node.id}
                    onPointerEnter={() => setHoveredNodeId(node.id)}
                    onPointerLeave={() =>
                      setHoveredNodeId((id) => (id === node.id ? null : id))
                    }
                    style={{
                      opacity: dimmed ? 0.22 : 1,
                      cursor: "pointer",
                      transition: "opacity 180ms"
                    }}
                  >
                    <title>{node.label}</title>

                    {isEmphasized ? (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={r * 2.2 * scale}
                        fill={`url(#glow-${node.kind})`}
                      />
                    ) : null}

                    {/* Soft outer halo — always on, stronger for bigger nodes */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r * 1.35 * scale}
                      fill={`url(#glow-${node.kind})`}
                      opacity="0.45"
                    />

                    {/* Main sphere */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r * scale}
                      fill={`url(#sphere-${node.kind})`}
                      stroke={grad.ring}
                      strokeOpacity={isSelected ? 0.9 : isHovered ? 0.7 : 0.4}
                      strokeWidth={isSelected ? 1.6 : 1.1}
                      style={{
                        transition:
                          "r 180ms ease-out, stroke-opacity 180ms, stroke-width 180ms"
                      }}
                    />

                    {/* Top specular highlight — adds the 3D orb feel */}
                    <ellipse
                      cx={node.x - r * 0.32}
                      cy={node.y - r * 0.42}
                      rx={r * 0.42}
                      ry={r * 0.22}
                      fill="#ffffff"
                      opacity="0.28"
                      style={{ pointerEvents: "none" }}
                    />

                    {/* Label */}
                    <text
                      x={node.x}
                      y={node.y + r * scale + 16}
                      textAnchor="middle"
                      fontSize={node.kind === "agent" ? 10 : 11}
                      fontFamily="'Inter', ui-sans-serif, system-ui, sans-serif"
                      fontWeight={isEmphasized ? 600 : 500}
                      fill={
                        dimmed
                          ? COLORS.labelDim
                          : isEmphasized
                            ? COLORS.labelStrong
                            : COLORS.label
                      }
                      style={{
                        letterSpacing: "0.01em",
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

          <div
            className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-md border bg-black/40 px-3 py-2 text-[10px] text-slate-400 backdrop-blur"
            style={{ borderColor: COLORS.dotGrid }}
          >
            <span>click a node · drag to move · scroll to zoom · drag canvas to pan</span>
          </div>
        </div>
      </div>

      <aside
        className="hidden w-[360px] shrink-0 flex-col border-l lg:flex"
        style={{ borderColor: COLORS.dotGrid, background: "#070b15" }}
      >
        {selectedNode ? (
          <NodeInspector
            node={selectedNode}
            agent={selectedAgent}
            business={selectedBusiness}
            history={nodeHistory}
            onRefresh={() => setHistoryTick((t) => t + 1)}
            onClose={() => setSelectedNodeId(null)}
          />
        ) : (
          <NeuralLegend />
        )}
      </aside>
    </div>
  );
}

function NodeInspector({
  node,
  agent,
  business,
  history,
  onRefresh,
  onClose
}: {
  node: NeuralNode;
  agent: PulseAgent | null;
  business: PulseBusiness | null;
  history: ReturnType<typeof useNodeHistory>;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const grad = NODE_GRADIENTS[node.kind];
  const { events, loading, stats } = history;
  const lastRun = events.find((e) => e.kind === "action_run") ?? null;

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: COLORS.dotGrid }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {node.kind}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="space-y-5 overflow-y-auto px-5 py-5">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full"
              style={{
                background: `radial-gradient(circle at 30% 28%, ${grad.top} 0%, ${grad.mid} 55%, ${grad.deep} 100%)`,
                boxShadow: `0 0 24px ${grad.glow}66`
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-white">
                {node.label}
              </div>
              {agent ? (
                <div className="truncate text-xs text-slate-400">
                  {agent.role}
                </div>
              ) : business ? (
                <div className="truncate text-xs text-slate-400">
                  {business.agents.length} agents
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatBlock label="Events" value={stats.total} />
          <StatBlock label="Completed" value={stats.completed} tone="good" />
          <StatBlock label="Failed" value={stats.failed} tone="bad" />
        </div>

        {agent ? (
          <>
            <InspectorField label="Type" value={agent.type} />
            {business ? (
              <InspectorField label="Business" value={business.name} />
            ) : null}
          </>
        ) : null}

        {lastRun ? (
          <div
            className="rounded-md border p-3 text-xs"
            style={{ borderColor: COLORS.dotGrid, background: "#0a1222" }}
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Last run
            </div>
            <div className="text-slate-200">{lastRun.title}</div>
            <div className="mt-1 text-[11px] text-slate-500">
              {formatRelative(lastRun.createdAt)}
            </div>
            {lastRun.detail ? (
              <div
                className={cn(
                  "mt-2 line-clamp-2 text-[11px]",
                  lastRun.status === "failed" || lastRun.status === "error"
                    ? "text-red-400"
                    : "text-slate-400"
                )}
              >
                {lastRun.detail}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Recent activity
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="text-[10px] text-slate-500 hover:text-white"
            >
              Refresh
            </button>
          </div>
          {loading && events.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </div>
          ) : events.length === 0 ? (
            <div className="text-xs text-slate-500">
              No activity recorded for this node yet.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {events.slice(0, 12).map((ev) => (
                <HistoryRow key={ev.id} event={ev} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ event }: { event: ActivityEvent }) {
  const color = colorFor(event.status, event.kind);
  const isFailed = event.status === "failed" || event.status === "error";
  return (
    <li
      className="rounded-md border px-3 py-2"
      style={{ borderColor: COLORS.dotGrid, background: "#0a1222" }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-slate-200">{event.title}</div>
          <div className="text-[10px] text-slate-500">
            {formatRelative(event.createdAt)}
            {event.agentName ? ` · ${event.agentName}` : ""}
          </div>
          {event.detail && isFailed ? (
            <div className="mt-1 line-clamp-2 text-[10px] text-red-400">
              {event.detail}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function StatBlock({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "good" ? "#34d399" : tone === "bad" ? "#f87171" : "#cbd5e1";
  return (
    <div
      className="rounded-md border px-2 py-2 text-center"
      style={{ borderColor: COLORS.dotGrid, background: "#0a1222" }}
    >
      <div className="text-lg font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}

function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function NeuralLegend() {
  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-xs">
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          How to use it
        </div>
        <p className="leading-5 text-slate-400">
          Click any node to inspect recent activity, last run, and stats.
          Drag nodes to rearrange. Drag the canvas to pan. Scroll to zoom.
          Click empty space to dismiss. When an event fires, a signal
          travels inward along the curved edge.
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Nodes
        </div>
        <LegendRow color={NODE_GRADIENTS.master.ring} label="Master" />
        <LegendRow color={NODE_GRADIENTS.business.ring} label="Business" />
        <LegendRow color={NODE_GRADIENTS.agent.ring} label="Agent" />
      </div>
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Signal
        </div>
        <LegendRow color={STATUS_COLOR.default} label="Chat / action" />
        <LegendRow color="#fbbf24" label="Tool call" />
        <LegendRow color={STATUS_COLOR.completed} label="Completed" />
        <LegendRow color={STATUS_COLOR.failed} label="Failed" />
      </div>
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
