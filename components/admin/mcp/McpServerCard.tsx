"use client";

import { Activity, Clock4 } from "lucide-react";

import type { McpDefinition } from "@/lib/integrations/mcp-definitions";
import type { SafeMcpServerPayload } from "@/lib/integrations/safe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type McpServerCardProps = {
  server: SafeMcpServerPayload;
  definition: McpDefinition;
  businessName?: string | null;
  onConfigure: () => void;
  onRemove: () => void;
};

function statusBadge(server: SafeMcpServerPayload) {
  switch (server.status) {
    case "active":
      return <Badge variant="active">Active</Badge>;
    case "installing":
      return <Badge className="bg-brand-cyan/10 text-brand-cyan">Installing...</Badge>;
    case "error":
      return <Badge variant="error">Error</Badge>;
    default:
      return <Badge className="bg-ghost-raised text-slate-400">Disabled</Badge>;
  }
}

export function McpServerCard({
  server,
  definition,
  businessName,
  onConfigure,
  onRemove
}: McpServerCardProps) {
  return (
    <Card className="border-ghost-border bg-ghost-surface transition-all hover:border-ghost-border-strong">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ghost-raised text-2xl">
              {definition.icon}
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold text-white">{server.name}</div>
              <div className="text-xs text-slate-500">
                {definition.publisher} · v{definition.version}
              </div>
            </div>
          </div>
          {statusBadge(server)}
        </div>

        <div className="flex flex-wrap gap-2">
          {definition.capabilities.map((capability) => (
            <Badge key={capability} className="bg-ghost-raised text-slate-400">
              {capability}
            </Badge>
          ))}
        </div>

        <div className="grid gap-2 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-cyan" />
            {businessName || "Organization-wide"}
          </div>
          <div className="flex items-center gap-2">
            <Clock4 className="h-4 w-4 text-slate-500" />
            {server.lastHealthCheck
              ? `Last health check ${new Date(server.lastHealthCheck).toLocaleString()}`
              : "No health check yet"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onConfigure}>
            Configure
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-status-error hover:text-status-error"
            onClick={onRemove}
          >
            Remove
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
