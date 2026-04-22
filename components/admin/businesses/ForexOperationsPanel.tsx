"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, CheckCircle2, CircleDollarSign, TrendingUp } from "lucide-react";

import { Panel, PanelBody, PanelHeader, StatusDot } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type BrokerEquity = {
  broker: "oanda" | "tradovate";
  environment: string;
  balance: number | null;
  unrealizedPnl: number | null;
  availableMargin: number | null;
  currency: string;
  skipReason?: string;
};

type OpenPosition = {
  broker: "oanda" | "tradovate";
  instrument: string;
  direction: "long" | "short" | "flat";
  units: number;
  avgPrice: number | null;
  unrealizedPnl: number | null;
};

type RecentOrder = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  detail: string | null;
  broker: string | null;
  tradingMode: string | null;
};

type Snapshot = {
  generatedAt: string;
  brokerEquity: BrokerEquity[];
  openPositions: OpenPosition[];
  todayRealizedPnl: number;
  recentOrders: RecentOrder[];
  pendingApprovals: number;
  pendingLive: number;
};

type Props = {
  businessId: string;
};

function fmtUsd(n: number | null | undefined, currency: string = "USD"): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n < 0 ? "-" : ""}${currency === "USD" ? "$" : ""}${Math.abs(n).toLocaleString(
    undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  )}${currency !== "USD" ? ` ${currency}` : ""}`;
}

function pnlTone(n: number | null | undefined): "success" | "danger" | "muted" {
  if (n === null || n === undefined || !Number.isFinite(n)) return "muted";
  if (n > 0.005) return "success";
  if (n < -0.005) return "danger";
  return "muted";
}

export function ForexOperationsPanel({ businessId }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/businesses/${businessId}/forex-operations`,
          { credentials: "same-origin" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { snapshot: Snapshot };
        if (alive) setSnapshot(data.snapshot);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [businessId]);

  if (loading && !snapshot) return null;
  if (!snapshot) return null;

  const oandaEq = snapshot.brokerEquity.find((e) => e.broker === "oanda");
  const tvEq = snapshot.brokerEquity.find((e) => e.broker === "tradovate");
  const oandaConnected = oandaEq && !oandaEq.skipReason;
  const tvConnected = tvEq && !tvEq.skipReason;
  const anyConnected = oandaConnected || tvConnected;

  return (
    <Panel>
      <PanelHeader
        label="Forex operations"
        action={
          snapshot.pendingLive > 0 ? (
            <Link
              href="/admin/approvals"
              className="inline-flex items-center gap-1.5 rounded-md border border-state-warning/30 bg-state-warning/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-state-warning hover:brightness-110"
            >
              <CheckCircle2 className="h-3 w-3" />
              {snapshot.pendingLive} awaiting approval
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-surface px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-ink-muted">
              <Activity className="h-3 w-3" />
              {snapshot.openPositions.length} open
            </span>
          )
        }
      />
      <PanelBody className="space-y-4">
        {/* Top row: equity across brokers + today's P&L */}
        <div className="grid gap-2 sm:grid-cols-3">
          <BrokerCard equity={oandaEq} label="OANDA" />
          <BrokerCard equity={tvEq} label="Tradovate" />
          <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
                Today&apos;s realized P&amp;L
              </div>
              <TrendingUp className="h-3.5 w-3.5 text-ink-muted" />
            </div>
            <div
              className={cn(
                "mt-1 font-mono text-[14px] font-semibold",
                pnlTone(snapshot.todayRealizedPnl) === "success" &&
                  "text-state-success",
                pnlTone(snapshot.todayRealizedPnl) === "danger" &&
                  "text-state-danger",
                pnlTone(snapshot.todayRealizedPnl) === "muted" &&
                  "text-ink-primary"
              )}
            >
              {snapshot.todayRealizedPnl >= 0 ? "+" : ""}
              {fmtUsd(snapshot.todayRealizedPnl)}
            </div>
            <div className="mt-0.5 text-[10.5px] text-ink-muted">
              Broker day (17:00 NY)
            </div>
          </div>
        </div>

        {/* Open positions */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
              Open positions
            </div>
            {!anyConnected ? (
              <span className="text-[10.5px] text-ink-muted">
                Connect OANDA or Tradovate to see positions
              </span>
            ) : null}
          </div>
          {snapshot.openPositions.length === 0 ? (
            <div className="rounded-md border border-line-subtle bg-bg-app/30 px-3 py-2 text-[11.5px] text-ink-secondary">
              No open positions across connected brokers.
            </div>
          ) : (
            <div className="grid gap-1.5">
              {snapshot.openPositions.map((pos, i) => (
                <PositionRow key={`${pos.broker}-${pos.instrument}-${i}`} position={pos} />
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="space-y-1.5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Recent orders (last 10)
          </div>
          {snapshot.recentOrders.length === 0 ? (
            <div className="rounded-md border border-line-subtle bg-bg-app/30 px-3 py-2 text-[11.5px] text-ink-secondary">
              No forex orders yet. The Execution Agent logs every proposal
              here once it runs.
            </div>
          ) : (
            <div className="grid gap-1">
              {snapshot.recentOrders.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-[10.5px] text-ink-muted">
          <span className="font-mono">
            Updated {new Date(snapshot.generatedAt).toLocaleTimeString()}
          </span>
          <span>Polls every 30s</span>
        </div>
      </PanelBody>
    </Panel>
  );
}

function BrokerCard({
  equity,
  label
}: {
  equity: BrokerEquity | undefined;
  label: string;
}) {
  const connected = equity && !equity.skipReason;
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5",
        connected
          ? "border-line-subtle bg-bg-app/50"
          : "border-line-subtle bg-bg-surface-2/50"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
          {label}
        </div>
        {connected ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-ink-muted">
            <StatusDot tone="success" />
            {equity?.environment ?? ""}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase text-ink-muted">
            not connected
          </span>
        )}
      </div>
      {connected && equity ? (
        <>
          <div className="mt-1 flex items-center gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5 text-ink-muted" />
            <span className="font-mono text-[13.5px] font-semibold text-ink-primary">
              {fmtUsd(equity.balance, equity.currency)}
            </span>
          </div>
          {typeof equity.unrealizedPnl === "number" ? (
            <div
              className={cn(
                "mt-0.5 font-mono text-[11px]",
                pnlTone(equity.unrealizedPnl) === "success" && "text-state-success",
                pnlTone(equity.unrealizedPnl) === "danger" && "text-state-danger",
                pnlTone(equity.unrealizedPnl) === "muted" && "text-ink-secondary"
              )}
            >
              Unrealized {equity.unrealizedPnl >= 0 ? "+" : ""}
              {fmtUsd(equity.unrealizedPnl, equity.currency)}
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          {equity?.skipReason ?? "Install the integration to see equity."}
        </div>
      )}
    </div>
  );
}

function PositionRow({ position }: { position: OpenPosition }) {
  const directionClass =
    position.direction === "long"
      ? "border-state-success/30 bg-state-success/10 text-state-success"
      : position.direction === "short"
        ? "border-state-danger/30 bg-state-danger/10 text-state-danger"
        : "border-line-subtle bg-bg-surface-2 text-ink-secondary";
  return (
    <div className="flex items-center gap-2 rounded-md border border-line-subtle bg-bg-surface px-3 py-1.5">
      <span
        className={cn(
          "rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
          directionClass
        )}
      >
        {position.direction}
      </span>
      <span className="font-mono text-[12.5px] font-semibold text-ink-primary">
        {position.instrument}
      </span>
      <span className="font-mono text-[11px] text-ink-secondary">
        {position.units.toLocaleString()}
      </span>
      <span className="font-mono text-[10px] uppercase text-ink-muted">
        {position.broker}
      </span>
      {position.avgPrice !== null ? (
        <span className="font-mono text-[11px] text-ink-muted">
          @ {position.avgPrice.toFixed(5)}
        </span>
      ) : null}
      {position.unrealizedPnl !== null ? (
        <span
          className={cn(
            "ml-auto font-mono text-[11.5px]",
            pnlTone(position.unrealizedPnl) === "success" && "text-state-success",
            pnlTone(position.unrealizedPnl) === "danger" && "text-state-danger",
            pnlTone(position.unrealizedPnl) === "muted" && "text-ink-secondary"
          )}
        >
          {position.unrealizedPnl >= 0 ? "+" : ""}
          {fmtUsd(position.unrealizedPnl)}
        </span>
      ) : null}
    </div>
  );
}

function OrderRow({ order }: { order: RecentOrder }) {
  const statusTone =
    order.status === "completed"
      ? "success"
      : order.status === "pending"
        ? "warning"
        : order.status === "failed"
          ? "danger"
          : "muted";
  const when = new Date(order.createdAt);
  const timeLabel = when.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
  return (
    <div className="flex items-center gap-2 rounded-md border border-line-subtle bg-bg-surface px-3 py-1.5">
      <StatusDot tone={statusTone} />
      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-primary">
        {order.title}
      </span>
      {order.tradingMode ? (
        <span className="font-mono text-[10px] uppercase text-ink-muted">
          {order.tradingMode === "live_approval" ? "live" : order.tradingMode}
        </span>
      ) : null}
      <span className="font-mono text-[10px] text-ink-muted">{timeLabel}</span>
    </div>
  );
}
