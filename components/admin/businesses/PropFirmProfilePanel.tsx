"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, X } from "lucide-react";

import { Panel, PanelBody, PanelHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { cn } from "@/lib/utils";

type Preset = {
  firmKey: string;
  firmName: string;
  planName: string;
  summary: string;
  jurisdictionFit: string[];
  rules: Record<string, unknown>;
};

type ActiveProfile = {
  id: string;
  firmKey: string;
  planName: string;
  startingBalance: number;
  highWaterMark: number;
  status: string;
  createdAt: string;
};

type PropFirmProfilePanelProps = {
  businessId: string;
  jurisdiction: string | null;
};

export function PropFirmProfilePanel({
  businessId,
  jurisdiction
}: PropFirmProfilePanelProps) {
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [active, setActive] = useState<ActiveProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [balance, setBalance] = useState<string>("50000");
  const [working, setWorking] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [profileRes, presetsRes] = await Promise.all([
          fetch(`/api/admin/businesses/${businessId}/prop-firm`, {
            credentials: "same-origin"
          }),
          fetch(
            jurisdiction
              ? `/api/admin/prop-firm-presets?jurisdiction=${encodeURIComponent(jurisdiction)}`
              : `/api/admin/prop-firm-presets`,
            { credentials: "same-origin" }
          )
        ]);
        if (!alive) return;
        if (profileRes.ok) {
          const profileData = (await profileRes.json()) as {
            profile: ActiveProfile | null;
          };
          setActive(profileData.profile);
        }
        if (presetsRes.ok) {
          const presetsData = (await presetsRes.json()) as { presets: Preset[] };
          setPresets(presetsData.presets);
        }
      } catch {
        // silent — toast would be too noisy for a passive panel load
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [businessId, jurisdiction]);

  async function attach() {
    if (!selectedKey) {
      toast.error("Pick a firm preset first.");
      return;
    }
    const parsedBalance = Number(balance);
    if (!Number.isFinite(parsedBalance) || parsedBalance <= 0) {
      toast.error("Enter a valid starting balance in USD.");
      return;
    }
    setWorking(true);
    try {
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/prop-firm`,
        {
          method: "POST",
          body: JSON.stringify({
            firmKey: selectedKey,
            startingBalance: parsedBalance,
            usePreset: true
          })
        }
      );
      const data = (await res.json()) as {
        profile?: ActiveProfile;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.profile) {
        toast.error(data.error || "Failed to attach preset.");
        return;
      }
      toast.success(data.message || "Preset attached.");
      setActive(data.profile);
      setFormOpen(false);
      setSelectedKey("");
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  async function detach() {
    setWorking(true);
    try {
      const res = await fetchWithCsrf(
        `/api/admin/businesses/${businessId}/prop-firm`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Failed to detach profile.");
        return;
      }
      toast.success(data.message || "Profile detached.");
      setActive(null);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        label="Prop-firm profile"
        action={
          active ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void detach()}
              disabled={working}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Detach
            </Button>
          ) : !formOpen ? (
            <Button
              size="sm"
              onClick={() => setFormOpen(true)}
              disabled={loading}
            >
              <Landmark className="mr-1.5 h-3.5 w-3.5" />
              Attach profile
            </Button>
          ) : null
        }
      />
      <PanelBody className="space-y-3">
        {loading ? (
          <p className="text-[12px] text-ink-secondary">Loading…</p>
        ) : active ? (
          <ActiveProfileSummary profile={active} />
        ) : !formOpen ? (
          <p className="text-[12px] leading-relaxed text-ink-secondary">
            No prop-firm profile attached. Attach one to enable real-time
            distance-to-bust tracking on every rule (daily drawdown, max
            drawdown, consistency). The Risk Gate Agent will also use the
            active profile to reject orders that would bust a rule under
            adverse fill.
          </p>
        ) : null}

        {formOpen && !active ? (
          <div className="space-y-3 rounded-md border border-line-subtle bg-bg-app/40 p-3">
            <div className="text-[12.5px] font-medium text-ink-primary">
              Pick a preset
            </div>
            <div className="grid gap-2">
              {presets.map((preset) => {
                const selected = selectedKey === preset.firmKey;
                return (
                  <button
                    key={preset.firmKey}
                    type="button"
                    onClick={() => setSelectedKey(preset.firmKey)}
                    className={cn(
                      "rounded-md border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-steel/60 bg-steel/10"
                        : "border-line-subtle bg-bg-surface hover:border-line"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-medium text-ink-primary">
                        {preset.firmName}
                      </div>
                      <span className="font-mono text-[10.5px] text-ink-muted">
                        {preset.firmKey.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-ink-secondary">
                      {preset.planName}
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                      {preset.summary}
                    </div>
                  </button>
                );
              })}
              {presets.length === 0 ? (
                <p className="text-[12px] text-ink-secondary">
                  No presets match your jurisdiction. Use the &quot;custom&quot;
                  preset to enter a bespoke rule set.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
                Starting balance (USD)
              </label>
              <Input
                value={balance}
                onChange={(event) => setBalance(event.target.value)}
                placeholder="50000"
                disabled={working}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => void attach()}
                disabled={working || !selectedKey}
              >
                Attach
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFormOpen(false);
                  setSelectedKey("");
                }}
                disabled={working}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function ActiveProfileSummary({ profile }: { profile: ActiveProfile }) {
  return (
    <div className="rounded-md border border-line-subtle bg-bg-app/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            {profile.firmKey}
          </div>
          <div className="mt-0.5 text-[13.5px] font-semibold text-ink-primary">
            {profile.planName}
          </div>
          <div className="mt-0.5 text-[11.5px] text-ink-secondary">
            Starting balance $
            {profile.startingBalance.toLocaleString(undefined, {
              maximumFractionDigits: 2
            })}
            {" · "}
            HWM $
            {profile.highWaterMark.toLocaleString(undefined, {
              maximumFractionDigits: 2
            })}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
            profile.status === "active"
              ? "border-state-success/30 bg-state-success/10 text-state-success"
              : profile.status === "busted"
                ? "border-state-danger/30 bg-state-danger/10 text-state-danger"
                : "border-line-subtle bg-bg-surface-2 text-ink-secondary"
          )}
        >
          {profile.status}
        </span>
      </div>
    </div>
  );
}
