import { StatusDot } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type ForexOrderIntent = {
  instrument?: string;
  side?: "buy" | "sell";
  units?: number;
  signedUnits?: number;
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
  thesis?: string;
  catalyst?: string;
  invalidation?: string;
  expectedHoldingHours?: number | null;
  submittedAt?: string;
  tradingMode?: string;
  agentId?: string | null;
};

type ForexOrderCardProps = {
  detail: unknown;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Risk-language rendering of a place_forex_order approval request. Replaces
 * the generic JsonViewer so operators see the thesis, catalyst, invalidation,
 * stop, and expected loss in bold — in the format the BIS / FX Global Code
 * materials recommend for professional trade documentation.
 */
export function ForexOrderCard({ detail }: ForexOrderCardProps) {
  const intent = (detail ?? {}) as ForexOrderIntent;
  const side = intent.side;
  const units = num(intent.units);
  const instrument = intent.instrument ?? "—";
  const stopLossPrice = num(intent.stopLossPrice);
  const takeProfitPrice = num(intent.takeProfitPrice);
  const holding = intent.expectedHoldingHours;
  const mode = intent.tradingMode ?? "unknown";

  const sideLabel =
    side === "buy" ? "LONG" : side === "sell" ? "SHORT" : "—";
  const sideClass =
    side === "buy"
      ? "border-state-success/30 bg-state-success/10 text-state-success"
      : side === "sell"
        ? "border-state-danger/30 bg-state-danger/10 text-state-danger"
        : "border-line-subtle bg-bg-surface-2 text-ink-secondary";

  return (
    <div className="space-y-3 rounded-md border border-line-subtle bg-bg-app/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-medium uppercase tracking-wide",
            sideClass
          )}
        >
          {sideLabel}
        </span>
        <span className="font-mono text-[13px] font-semibold text-ink-primary">
          {instrument}
        </span>
        {units !== null ? (
          <span className="font-mono text-[11.5px] text-ink-secondary">
            {units.toLocaleString()} units
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-bg-surface px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-secondary">
          <StatusDot tone={mode === "live_approval" ? "live" : "warning"} />
          {mode === "live_approval" ? "Live · awaiting click" : mode}
        </span>
      </div>

      <Section label="Thesis" value={intent.thesis} />
      <Section label="Catalyst" value={intent.catalyst} />
      <Section label="Invalidation" value={intent.invalidation} />

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCell
          label="Stop loss"
          value={
            stopLossPrice !== null
              ? stopLossPrice.toFixed(5)
              : "—"
          }
          tone={stopLossPrice !== null ? "default" : "warning"}
        />
        <MetricCell
          label="Take profit"
          value={
            takeProfitPrice !== null ? takeProfitPrice.toFixed(5) : "None set"
          }
          tone={takeProfitPrice !== null ? "default" : "muted"}
        />
        <MetricCell
          label="Expected hold"
          value={
            typeof holding === "number" && Number.isFinite(holding)
              ? `${holding}h`
              : "—"
          }
        />
      </div>

      <div className="rounded-md border border-state-warning/25 bg-state-warning/5 px-3 py-2 text-[11.5px] leading-relaxed text-ink-secondary">
        Not financial advice. Approving this request fires the order through
        the connected broker at its next tick price — slippage modeling is
        empirical, not theoretical. The Risk Gate has already checked the
        jurisdiction leverage cap, correlation ceiling, daily-loss headroom,
        and prop-firm rule headroom before this card was shown.
      </div>
    </div>
  );
}

function Section({
  label,
  value
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 text-[12.5px] leading-6 text-ink-primary">
        {value?.trim() ? value : "—"}
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-bg-surface px-2.5 py-2",
        tone === "warning" && "border-state-warning/30",
        tone === "muted" && "border-line-subtle",
        tone === "default" && "border-line-subtle"
      )}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-[13px] font-semibold",
          tone === "warning" && "text-state-warning",
          tone === "muted" && "text-ink-muted",
          tone === "default" && "text-ink-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}
