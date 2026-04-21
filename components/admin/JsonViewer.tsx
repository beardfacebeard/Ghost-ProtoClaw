"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

type JsonViewerProps = {
  data: unknown;
  maxHeight?: number;
  collapsed?: boolean;
  collapsedLabel?: string;
  expandedLabel?: string;
};

function renderJsonValue(value: unknown, depth = 0): React.ReactNode {
  const indent = {
    paddingLeft: `${depth * 16}px`
  };

  if (value === null) {
    return <span className="text-red-300">null</span>;
  }

  if (typeof value === "string") {
    return <span className="text-green-300">{`"${value}"`}</span>;
  }

  if (typeof value === "number") {
    return <span className="text-steel-bright">{value}</span>;
  }

  if (typeof value === "boolean") {
    return <span className="text-state-warning">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span>[]</span>;
    }

    return (
      <div>
        <div>[</div>
        {value.map((entry, index) => (
          <div key={`${depth}-${index}`} style={indent}>
            {renderJsonValue(entry, depth + 1)}
            {index < value.length - 1 ? "," : ""}
          </div>
        ))}
        <div>]</div>
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      return <span>{"{}"}</span>;
    }

    return (
      <div>
        <div>{"{"}</div>
        {entries.map(([key, entryValue], index) => (
          <div key={`${depth}-${key}`} style={indent}>
            <span className="text-white">{`"${key}"`}</span>
            <span>: </span>
            {renderJsonValue(entryValue, depth + 1)}
            {index < entries.length - 1 ? "," : ""}
          </div>
        ))}
        <div>{"}"}</div>
      </div>
    );
  }

  return <span className="text-ink-secondary">{String(value)}</span>;
}

export function JsonViewer({
  data,
  maxHeight = 320,
  collapsed = false,
  collapsedLabel = "Show JSON",
  expandedLabel = "Hide JSON"
}: JsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(!collapsed);
  const serialized = useMemo(() => JSON.stringify(data, null, 2), [data]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(serialized);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line-subtle bg-bg-app">
      <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
        <button
          type="button"
          className="text-sm font-medium text-white transition-colors hover:text-steel-bright"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? expandedLabel : collapsedLabel}
        </button>
        <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {expanded ? (
        <div
          className="overflow-auto px-4 py-4 font-mono text-xs leading-6"
          style={{ maxHeight }}
        >
          {renderJsonValue(data)}
        </div>
      ) : null}
    </div>
  );
}
