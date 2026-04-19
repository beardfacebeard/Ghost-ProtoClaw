"use client";

import { ArrowUpRight, ExternalLink, Link2 } from "lucide-react";

import type { IntegrationDefinition } from "@/lib/integrations/integration-definitions";
import type { SafeIntegrationPayload } from "@/lib/integrations/safe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type IntegrationCardProps = {
  definition: IntegrationDefinition;
  integration?: SafeIntegrationPayload;
  onConnect: () => void;
  onDisconnect: () => void;
  onTest: () => void;
};

function authTypeLabel(authType: IntegrationDefinition["authType"]) {
  switch (authType) {
    case "api_key":
      return "API Key";
    case "oauth":
      return "OAuth";
    case "bearer":
      return "Bearer";
    case "multi_key":
      return "Multi-Key";
    default:
      return authType;
  }
}

function categoryLabel(category: string) {
  return category.replace(/_/g, " ").replace(/\b\w/g, (value) => value.toUpperCase());
}

function pricingBadgeProps(
  tier: NonNullable<IntegrationDefinition["pricingTier"]>
): { label: string; className: string } {
  switch (tier) {
    case "free":
      return {
        label: "Free",
        className: "bg-status-active/15 text-status-active"
      };
    case "freemium":
      return {
        label: "Free tier + paid",
        className: "bg-brand-cyan/15 text-brand-cyan"
      };
    case "paid":
      return {
        label: "Paid",
        className: "bg-brand-amber/15 text-brand-amber"
      };
  }
}

function primaryLabel(definition: IntegrationDefinition) {
  if (definition.comingSoon) {
    return "Coming Soon";
  }

  if (definition.authType === "oauth") {
    if (definition.oauthProvider === "google") {
      return "Connect with Google";
    }

    if (definition.oauthProvider === "openrouter") {
      return "Connect with OpenRouter";
    }
  }

  return "Configure";
}

export function IntegrationCard({
  definition,
  integration,
  onConnect,
  onDisconnect,
  onTest
}: IntegrationCardProps) {
  const connected = integration?.status === "connected";

  return (
    <Card className="border-ghost-border bg-ghost-surface transition-all hover:border-ghost-border-strong">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ghost-raised text-2xl">
              {definition.icon}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold text-white">{definition.name}</div>
                <Badge className="bg-ghost-raised text-slate-400">
                  {categoryLabel(definition.category)}
                </Badge>
              </div>
              <p className="line-clamp-2 text-sm leading-6 text-slate-400">
                {definition.description}
              </p>
            </div>
          </div>

          {definition.comingSoon ? (
            <Badge className="bg-ghost-raised text-slate-500">Coming soon</Badge>
          ) : connected ? (
            <Badge variant="active">Connected ✓</Badge>
          ) : integration?.status === "error" ? (
            <Badge variant="error">Error</Badge>
          ) : (
            <Badge className="bg-ghost-raised text-slate-400">Not connected</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-brand-cyan/10 text-brand-cyan">
            {authTypeLabel(definition.authType)}
          </Badge>
          {definition.pricingTier ? (
            (() => {
              const pricing = pricingBadgeProps(definition.pricingTier);
              return <Badge className={pricing.className}>{pricing.label}</Badge>;
            })()
          ) : null}
          {definition.tags.map((tag) => (
            <Badge key={tag} className="bg-ghost-raised text-slate-500">
              {tag}
            </Badge>
          ))}
        </div>

        {definition.pricingNote ? (
          <div className="rounded-xl border border-ghost-border bg-ghost-raised/40 px-3 py-2 text-xs leading-5 text-slate-300">
            <span className="font-medium text-white">Pricing:</span>{" "}
            {definition.pricingNote}
          </div>
        ) : null}

        {definition.setupSteps && definition.setupSteps.length > 0 ? (
          <div className="rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 px-3 py-2 text-xs leading-5 text-slate-300">
            <div className="mb-1 font-medium text-brand-cyan">Setup</div>
            <ol className="list-decimal space-y-1 pl-4 text-slate-300">
              {definition.setupSteps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        ) : definition.setupNotes ? (
          <div className="rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 px-3 py-2 text-xs leading-5 text-slate-300">
            <span className="font-medium text-brand-cyan">Setup:</span>{" "}
            {definition.setupNotes}
          </div>
        ) : null}

        {definition.authType === "oauth" && definition.oauthProvider ? (
          <div className="rounded-xl border border-brand-cyan/20 bg-brand-cyan/10 px-3 py-2 text-xs leading-5 text-slate-300">
            Connects via {definition.oauthProvider === "google" ? "Google" : "provider"} OAuth
            {definition.oauthProvider === "google" ? " - one click setup" : " for quick setup"}.
          </div>
        ) : null}

        {connected ? (
          <div className="space-y-2 text-xs text-slate-500">
            <div>
              Connected {integration.updatedAt ? new Date(integration.updatedAt).toLocaleDateString() : "recently"}
            </div>
            <div>
              Assigned businesses: {integration.scope === "organization" ? "All" : integration.assignedBusinessIds.length}
            </div>
            <div>Secrets stored securely: {integration.hasSecrets ? "Yes" : "No"}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <Button
              type="button"
              disabled={Boolean(definition.comingSoon)}
              onClick={onConnect}
            >
              {primaryLabel(definition)}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onTest}>
                Test
              </Button>
              <Button type="button" variant="outline" onClick={onConnect}>
                Configure
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-status-error hover:text-status-error"
                onClick={onDisconnect}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>

        {(definition.website || definition.docs) && (
          <div className="flex flex-wrap gap-4 pt-1">
            {definition.website ? (
              <a
                href={definition.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Visit site
                <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : null}
            {definition.docs ? (
              <a
                href={definition.docs}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-white"
              >
                <Link2 className="h-3.5 w-3.5" />
                View docs
                <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
