"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, Pause, Play, X } from "lucide-react";

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

type NeuralEdge = ForceEdge & { id: string };

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
  bgInner: "#0a0e17",
  bgOuter: "#04060c",
  panel: "#06090f",
  panelBorder: "#111a2a",
  edge: "#1f2a3d",
  edgeFocus: "#334155",
  edgeActive: "#7dd3fc",
  label: "#94a3b8",
  labelStrong: "#f1f5f9",
  labelDim: "#334155"
};

const NODE_COLORS = {
  master: { core: "#a78bfa", glow: "#8b5cf6", rim: "#c4b5fd" },
  business: { core: "#38bdf8", glow: "#0ea5e9", rim: "#7dd3fc" },
  agent: { core: "#64748b", glow: "#475569", rim: "#94a3b8" }
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
  return kind === "master" ? 13 : kind === "business" ? 9 : 6;
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
    const radius = 300;
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
      length: 260
    });
    business.agents.forEach((agent, j) => {
      const agentCount = Math.max(business.agents.length, 1);
      const spread = Math.min(1.4, 0.25 + agentCount * 0.13);
      const subAngle =
        angle + ((j / agentCount) - 0.5 + 0.5 / agentCount) * spread;
      const subRadius = radius + 210;
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
        length: 180
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

function useNodeHistory(node: NeuralNode | null, refreshTick: number) {
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
  return { events, loading, stats: { total: events.length, failed, completed } };
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function edgePath(a: NeuralNode, b: NeuralNode) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return `M ${a.x} ${a.y} Q ${mx + -dy * 0.12} ${my + dx * 0.12} ${b.x} ${b.y}`;
}

function bezierPath(a: NeuralNode, b: NeuralNode, fromBToA: boolean) {
  const steps = 20;
  const points: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const tAlong = fromBToA ? 1 - i / steps : i / steps;
    const u = 1 - tAlong;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const cx = mx + -(b.y - a.y) * 0.12;
    const cy = my + (b.x - a.x) * 0.12;
    const px = u * u * a.x + 2 * u * tAlong * cx + tAlong * tAlong * b.x;
    const py = u * u * a.y + 2 * u * tAlong * cy + tAlong * tAlong * b.y;
    points.push(i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`);
  }
  return points.join(" ");
}

const VB_W = 1400;
const VB_H = 900;

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

  useEffect(() => {
    const g = buildGraph(topology);
    nodesRef.current = g.nodes;
    edgesRef.current = g.edges;
    setRenderTick((t) => t + 1);
  }, [topology]);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      tick(nodesRef.current, edgesRef.current, {
        repulsion: 34000,
        springStrength: 0.038,
        centering: 0.0028,
        damping: 0.88
      });
      setRenderTick((t) => t + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

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
      const svgX = ((clientX - rect.left) / rect.width) * VB_W;
      const svgY = ((clientY - rect.top) / rect.height) * VB_H;
      return {
        x: (svgX - VB_W / 2 - pan.x) / scale,
        y: (svgY - VB_H / 2 - pan.y) / scale
      };
    },
    [pan, scale]
  );

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
        setPan({ x: drag.origPanX + dx, y: drag.origPanY + dy });
      }
    },
    [screenToGraph]
  );

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
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
      setSelectedNodeId(null);
    }
    pointerRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    setScale((s) => Math.max(0.35, Math.min(3.2, s * factor)));
  }, []);

  const fitToView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

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
    <div
      className="flex h-full"
      style={{ background: COLORS.bgOuter }}
    >
      {/* Main canvas column */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div
          className="flex shrink-0 items-center gap-3 border-b px-5 py-3"
          style={{ borderColor: COLORS.panelBorder }}
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
          <div className="text-[11px] tracking-wide text-slate-500">
            {nodesRef.current.filter((n) => n.kind === "agent").length} agents ·{" "}
            {topology.businesses.length} businesses
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={fitToView}
              className="h-7 gap-1.5 text-[11px] text-slate-400 hover:text-white"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Fit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPaused((p) => !p)}
              className="h-7 gap-1.5 text-[11px] text-slate-400 hover:text-white"
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

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[11px] text-slate-600">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Waiting for activity…
            </div>
          ) : null}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${VB_W} ${VB_H}`}
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
              <radialGradient id="neural-bg" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor={COLORS.bgInner} />
                <stop offset="100%" stopColor={COLORS.bgOuter} />
              </radialGradient>
              {(Object.keys(NODE_COLORS) as Array<keyof typeof NODE_COLORS>).map((k) => {
                const c = NODE_COLORS[k];
                return (
                  <g key={k}>
                    <radialGradient id={`node-core-${k}`} cx="32%" cy="28%" r="70%">
                      <stop offset="0%" stopColor={c.rim} stopOpacity="1" />
                      <stop offset="65%" stopColor={c.core} stopOpacity="1" />
                      <stop offset="100%" stopColor={c.glow} stopOpacity="0.85" />
                    </radialGradient>
                    <radialGradient id={`node-halo-${k}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={c.glow} stopOpacity="0.85" />
                      <stop offset="50%" stopColor={c.glow} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={c.glow} stopOpacity="0" />
                    </radialGradient>
                  </g>
                );
              })}
            </defs>

            <rect width={VB_W} height={VB_H} fill="url(#neural-bg)" />

            <g
              transform={`translate(${VB_W / 2 + pan.x} ${VB_H / 2 + pan.y}) scale(${scale})`}
            >
              {edgesRef.current.map((edge) => {
                const a = nodeIndex.get(edge.source);
                const b = nodeIndex.get(edge.target);
                if (!a || !b) return null;
                const active = firingsRef.current.some((f) =>
                  f.path.includes(edge.id)
                );
                const inFocus =
                  focusedNeighborhood?.edges.has(edge.id) ?? false;
                const dimmed = focusedNeighborhood && !inFocus;
                return (
                  <path
                    key={edge.id}
                    d={edgePath(a, b)}
                    fill="none"
                    stroke={
                      active
                        ? COLORS.edgeActive
                        : inFocus
                          ? COLORS.edgeFocus
                          : COLORS.edge
                    }
                    strokeWidth={active ? 1.5 : inFocus ? 1.1 : 0.7}
                    opacity={dimmed ? 0.08 : active ? 0.95 : 0.55}
                    style={{ transition: "opacity 200ms, stroke 200ms" }}
                  />
                );
              })}

              {firingsRef.current.flatMap((firing) =>
                firing.path.map((edgeId, hopIndex) => {
                  const edge = edgeIndex.get(edgeId);
                  if (!edge) return null;
                  const parent = nodeIndex.get(edge.source);
                  const child = nodeIndex.get(edge.target);
                  if (!parent || !child) return null;
                  const path = bezierPath(parent, child, true);
                  const delay = hopIndex * (FIRING_HOP_MS * 0.85);
                  return (
                    <g key={`${firing.id}-${hopIndex}`}>
                      <circle r="5" fill={firing.color} opacity="0.2">
                        <animateMotion
                          dur={`${FIRING_HOP_MS / 1000}s`}
                          begin={`${delay / 1000}s`}
                          fill="freeze"
                          path={path}
                        />
                        <animate
                          attributeName="opacity"
                          values="0;0.2;0.2;0"
                          keyTimes="0;0.2;0.8;1"
                          dur={`${FIRING_HOP_MS / 1000}s`}
                          begin={`${delay / 1000}s`}
                          fill="freeze"
                        />
                      </circle>
                      <circle r="2.5" fill={firing.color}>
                        <animateMotion
                          dur={`${FIRING_HOP_MS / 1000}s`}
                          begin={`${delay / 1000}s`}
                          fill="freeze"
                          path={path}
                        />
                        <animate
                          attributeName="opacity"
                          values="0;1;1;0"
                          keyTimes="0;0.15;0.85;1"
                          dur={`${FIRING_HOP_MS / 1000}s`}
                          begin={`${delay / 1000}s`}
                          fill="freeze"
                        />
                      </circle>
                    </g>
                  );
                })
              )}

              {nodesRef.current.map((node) => {
                const isSelected = node.id === selectedNodeId;
                const isHovered = node.id === hoveredNodeId;
                const inFocus =
                  focusedNeighborhood?.nodes.has(node.id) ?? false;
                const dimmed = focusedNeighborhood && !inFocus;
                const r = nodeRadius(node.kind);
                const emphasis = isSelected ? 1.35 : isHovered ? 1.15 : 1;
                const c = NODE_COLORS[node.kind];
                const recentlyFired = firingsRef.current.some((f) =>
                  f.path.some((id) => id.endsWith(`->${node.id}`))
                );
                const showLabel =
                  node.kind === "master" ||
                  isSelected ||
                  isHovered ||
                  inFocus ||
                  recentlyFired;

                return (
                  <g
                    key={node.id}
                    data-node-id={node.id}
                    onPointerEnter={() => setHoveredNodeId(node.id)}
                    onPointerLeave={() =>
                      setHoveredNodeId((id) => (id === node.id ? null : id))
                    }
                    style={{
                      opacity: dimmed ? 0.2 : 1,
                      cursor: "pointer",
                      transition: "opacity 200ms"
                    }}
                  >
                    <title>{node.label}</title>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r * 3.2 * emphasis}
                      fill={`url(#node-halo-${node.kind})`}
                      opacity={isSelected || isHovered ? 0.95 : 0.55}
                    />
                    {recentlyFired ? (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={r * 1.7}
                        fill="none"
                        stroke={c.rim}
                        strokeWidth="1"
                        opacity="0.65"
                      />
                    ) : null}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r * emphasis}
                      fill={`url(#node-core-${node.kind})`}
                      stroke={c.rim}
                      strokeOpacity={isSelected ? 0.95 : isHovered ? 0.7 : 0.35}
                      strokeWidth={isSelected ? 1.6 : 1}
                    />
                    <ellipse
                      cx={node.x - r * emphasis * 0.32}
                      cy={node.y - r * emphasis * 0.42}
                      rx={r * emphasis * 0.38}
                      ry={r * emphasis * 0.18}
                      fill="#ffffff"
                      opacity="0.35"
                      style={{ pointerEvents: "none" }}
                    />
                    {showLabel ? (
                      <text
                        x={node.x}
                        y={node.y + r * emphasis + 14}
                        textAnchor="middle"
                        fontSize={node.kind === "master" ? 11 : 10}
                        fontFamily="'Inter', ui-sans-serif, system-ui, sans-serif"
                        fontWeight={isSelected || isHovered ? 600 : 500}
                        fill={
                          dimmed
                            ? COLORS.labelDim
                            : isSelected || isHovered
                              ? COLORS.labelStrong
                              : COLORS.label
                        }
                        style={{
                          letterSpacing: "0.015em",
                          pointerEvents: "none"
                        }}
                      >
                        {node.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          </svg>

          <div
            className="pointer-events-none absolute bottom-3 left-3 rounded-md border px-3 py-2 text-[10px] text-slate-500"
            style={{
              borderColor: COLORS.panelBorder,
              background: "rgba(10, 14, 23, 0.7)",
              backdropFilter: "blur(6px)"
            }}
          >
            click · drag nodes · drag canvas to pan · scroll to zoom
          </div>
        </div>
      </div>

      {/* Right sidebar — always rendered so clicking doesn't shift the
          canvas. Content swaps between legend and inspector. */}
      <aside
        className="hidden w-[360px] shrink-0 flex-col border-l lg:flex"
        style={{ borderColor: COLORS.panelBorder, background: COLORS.panel }}
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
  const c = NODE_COLORS[node.kind];
  const { events, loading, stats } = history;
  const lastRun = events.find((e) => e.kind === "action_run") ?? null;

  return (
    <>
      <div
        className="flex shrink-0 items-center justify-between border-b px-5 py-3"
        style={{ borderColor: COLORS.panelBorder }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {node.kind}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 shrink-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 32% 28%, ${c.rim} 0%, ${c.core} 60%, ${c.glow} 100%)`,
              boxShadow: `0 0 28px ${c.glow}66`
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-white">
              {node.label}
            </div>
            {agent ? (
              <div className="truncate text-xs text-slate-400">{agent.role}</div>
            ) : business ? (
              <div className="truncate text-xs text-slate-400">
                {business.agents.length} agents
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatBlock label="Events" value={stats.total} />
          <StatBlock label="Completed" value={stats.completed} tone="good" />
          <StatBlock label="Failed" value={stats.failed} tone="bad" />
        </div>

        {agent ? <InspectorField label="Type" value={agent.type} /> : null}
        {business ? <InspectorField label="Business" value={business.name} /> : null}

        {lastRun ? (
          <div
            className="rounded-md border p-3 text-xs"
            style={{
              borderColor: COLORS.panelBorder,
              background: "rgba(10, 14, 23, 0.6)"
            }}
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
    </>
  );
}

function HistoryRow({ event }: { event: ActivityEvent }) {
  const color = colorFor(event.status, event.kind);
  const isFailed = event.status === "failed" || event.status === "error";
  return (
    <li
      className="rounded-md border px-3 py-2"
      style={{
        borderColor: COLORS.panelBorder,
        background: "rgba(10, 14, 23, 0.6)"
      }}
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
      style={{
        borderColor: COLORS.panelBorder,
        background: "rgba(10, 14, 23, 0.6)"
      }}
    >
      <div className="text-lg font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-slate-500">
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
          Click any node to see its recent activity, last run, and stats on
          this panel. Drag nodes to rearrange, drag the canvas to pan, scroll
          to zoom. Click empty space to deselect.
        </p>
      </div>
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Nodes
        </div>
        <LegendRow color={NODE_COLORS.master.rim} label="Master" />
        <LegendRow color={NODE_COLORS.business.rim} label="Business" />
        <LegendRow color={NODE_COLORS.agent.rim} label="Agent" />
      </div>
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Signal colors
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
