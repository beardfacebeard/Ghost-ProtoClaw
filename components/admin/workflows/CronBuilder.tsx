"use client";

import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

import {
  getNextCronRuns,
  validateCronExpression
} from "@/lib/workflows/schedule-parser";

const cronPresets = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every weekday 8am", value: "0 8 * * 1-5" },
  { label: "Every Monday 9am", value: "0 9 * * 1" },
  { label: "Every Sunday midnight", value: "0 0 * * 0" },
  { label: "First of month 9am", value: "0 9 1 * *" },
  { label: "Custom", value: "__custom__" }
] as const;

type CronBuilderProps = {
  value: string;
  onChange: (cron: string) => void;
};

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const validation = useMemo(
    () => (value ? validateCronExpression(value) : null),
    [value]
  );
  const nextRuns = useMemo(
    () => (validation?.valid && value ? getNextCronRuns(value, 3) : []),
    [validation?.valid, value]
  );

  return (
    <div className="space-y-4 rounded-2xl border border-ghost-border bg-ghost-raised/20 p-4">
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Select
          value={
            cronPresets.some((preset) => preset.value === value)
              ? value
              : "__custom__"
          }
          onValueChange={(preset) => {
            if (preset !== "__custom__") {
              onChange(preset);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a preset" />
          </SelectTrigger>
          <SelectContent>
            {cronPresets.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0 9 * * 1"
          className="font-mono"
        />
      </div>

      {value ? (
        <div className="space-y-2 rounded-xl border border-ghost-border bg-ghost-black px-4 py-3 text-sm">
          {validation?.valid ? (
            <>
              <div className="text-white">{validation.description}</div>
              {nextRuns.length > 0 ? (
                <div className="space-y-1 text-slate-400">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Next 3 runs
                  </div>
                  {nextRuns.map((run) => (
                    <div key={run.toISOString()}>
                      {run.toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-brand-primary">
              {validation?.error || "Enter a cron expression to validate it."}
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-500">
          Add a cron expression to see the plain-English translation and next run preview.
        </div>
      )}
    </div>
  );
}
