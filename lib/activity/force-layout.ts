/**
 * Minimal force-directed graph layout.
 *
 * Hand-rolled to avoid adding a d3/react-force-graph dependency. Good enough
 * for the Pulse Neural Map: pairwise node repulsion + edge springs + soft
 * centering + velocity damping. Run `settle()` a few dozen iterations on
 * mount to produce stable coordinates, then hand the result to an SVG
 * renderer — no continuous simulation required for our read-only graph.
 */

export type ForceNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Nodes with `fixed = true` stay at their initial coordinates. */
  fixed?: boolean;
};

export type ForceEdge = {
  source: string;
  target: string;
  /** Spring rest length. */
  length?: number;
};

type LayoutOptions = {
  /** Repulsion strength between every pair of nodes. */
  repulsion?: number;
  /** Spring constant for edges. */
  springStrength?: number;
  /** Default spring rest length when an edge doesn't override it. */
  defaultEdgeLength?: number;
  /** Weak pull toward (centerX, centerY) so the graph doesn't drift off. */
  centering?: number;
  centerX?: number;
  centerY?: number;
  /** Velocity damping per tick (lower = stops sooner). */
  damping?: number;
  /** Hard cap so extreme forces don't launch nodes off-screen. */
  maxVelocity?: number;
};

const DEFAULTS: Required<LayoutOptions> = {
  repulsion: 12000,
  springStrength: 0.05,
  defaultEdgeLength: 120,
  centering: 0.008,
  centerX: 0,
  centerY: 0,
  damping: 0.82,
  maxVelocity: 35
};

/**
 * Advance the simulation one tick. Mutates nodes in place.
 */
export function tick(
  nodes: ForceNode[],
  edges: ForceEdge[],
  options: LayoutOptions = {}
) {
  const opts = { ...DEFAULTS, ...options };
  const byId = new Map<string, ForceNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
  }

  // Pairwise repulsion
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j += 1) {
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        // Jitter to break perfect overlap
        dx = (Math.random() - 0.5) * 0.1;
        dy = (Math.random() - 0.5) * 0.1;
        d2 = dx * dx + dy * dy;
      }
      const force = opts.repulsion / d2;
      const d = Math.sqrt(d2);
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      if (!a.fixed) {
        a.vx -= fx;
        a.vy -= fy;
      }
      if (!b.fixed) {
        b.vx += fx;
        b.vy += fy;
      }
    }
  }

  // Edge springs
  for (const edge of edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const rest = edge.length ?? opts.defaultEdgeLength;
    const displacement = d - rest;
    const force = displacement * opts.springStrength;
    const fx = (dx / d) * force;
    const fy = (dy / d) * force;
    if (!a.fixed) {
      a.vx += fx;
      a.vy += fy;
    }
    if (!b.fixed) {
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // Centering + damping + integration
  for (const node of nodes) {
    if (node.fixed) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.vx += (opts.centerX - node.x) * opts.centering;
    node.vy += (opts.centerY - node.y) * opts.centering;
    node.vx *= opts.damping;
    node.vy *= opts.damping;
    // Velocity cap
    const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
    if (speed > opts.maxVelocity) {
      node.vx = (node.vx / speed) * opts.maxVelocity;
      node.vy = (node.vy / speed) * opts.maxVelocity;
    }
    node.x += node.vx;
    node.y += node.vy;
  }
}

/**
 * Run `iterations` ticks of the simulation. Convenience helper for
 * pre-settling a graph before first render.
 */
export function settle(
  nodes: ForceNode[],
  edges: ForceEdge[],
  iterations: number,
  options: LayoutOptions = {}
) {
  for (let i = 0; i < iterations; i += 1) {
    tick(nodes, edges, options);
  }
}
