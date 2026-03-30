"use client";

import type { McpDefinition } from "@/lib/integrations/mcp-definitions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type McpDefinitionCardProps = {
  definition: McpDefinition;
  isInstalled: boolean;
  dependencyMissing?: boolean;
  dependencyLabel?: string;
  onInstall: () => void;
};

export function McpDefinitionCard({
  definition,
  isInstalled,
  dependencyMissing = false,
  dependencyLabel,
  onInstall
}: McpDefinitionCardProps) {
  const canInstall =
    !definition.comingSoon && !isInstalled && !dependencyMissing;

  return (
    <Card className="border-ghost-border bg-ghost-surface transition-all hover:border-ghost-border-strong">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ghost-raised text-2xl">
              {definition.icon}
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold text-white">{definition.name}</div>
              <div className="text-xs text-slate-500">
                {definition.publisher} · v{definition.version}
              </div>
            </div>
          </div>
          {isInstalled ? (
            <Badge variant="active">Installed ✓</Badge>
          ) : definition.comingSoon ? (
            <Badge className="bg-ghost-raised text-slate-500">Coming soon</Badge>
          ) : null}
        </div>

        <p className="text-sm leading-6 text-slate-400">{definition.description}</p>

        <div className="flex flex-wrap gap-2">
          {definition.capabilities.map((capability) => (
            <Badge key={capability} className="bg-ghost-raised text-slate-400">
              {capability}
            </Badge>
          ))}
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          {definition.useCases.map((useCase) => (
            <div key={useCase}>• {useCase}</div>
          ))}
        </div>

        {dependencyMissing && dependencyLabel ? (
          <div className="rounded-xl border border-brand-amber/25 bg-brand-amber/10 px-3 py-2 text-xs leading-5 text-slate-200">
            Requires: {dependencyLabel}
          </div>
        ) : null}

        <Button
          type="button"
          disabled={!canInstall}
          variant={canInstall ? "default" : "outline"}
          onClick={onInstall}
          className="w-full"
        >
          {isInstalled
            ? "Installed ✓"
            : definition.comingSoon
              ? "Coming Soon"
              : dependencyMissing
                ? `Connect ${dependencyLabel || "dependency"} first`
                : "Install"}
        </Button>
      </CardContent>
    </Card>
  );
}
