"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plug, Search } from "lucide-react";

import type { IntegrationDefinition } from "@/lib/integrations/integration-definitions";
import type { SafeIntegrationPayload } from "@/lib/integrations/safe";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { IntegrationCard } from "@/components/admin/integrations/IntegrationCard";
import { IntegrationConfigModal } from "@/components/admin/integrations/IntegrationConfigModal";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";

type IntegrationsClientProps = {
  definitions: IntegrationDefinition[];
  integrations: SafeIntegrationPayload[];
  businesses: Array<{ id: string; name: string }>;
  sessionRole: "super_admin" | "admin";
};

const categoryGroups = [
  { id: "ai", label: "AI & Models", categories: ["ai"] },
  { id: "email", label: "Email & Calendar", categories: ["email", "calendar"] },
  { id: "crm", label: "CRM", categories: ["crm"] },
  { id: "payment", label: "Payments", categories: ["payment"] },
  { id: "communication", label: "Communication", categories: ["communication"] },
  { id: "developer", label: "Developer", categories: ["developer"] },
  { id: "storage", label: "Storage", categories: ["storage"] },
  { id: "marketing", label: "Marketing", categories: ["marketing"] }
] as const;

export function IntegrationsClient({
  definitions,
  integrations: initialIntegrations,
  businesses,
  sessionRole
}: IntegrationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<string>("all");
  const [selectedDefinition, setSelectedDefinition] = useState<IntegrationDefinition | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<SafeIntegrationPayload | null>(null);

  useEffect(() => {
    const connectedProvider = searchParams.get("connected");
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (connectedProvider && success === "true") {
      toast.success(
        `${connectedProvider === "google" ? "Google" : "OpenRouter"} connected successfully.`
      );
      router.replace("/admin/integrations");
    } else if (error === "oauth_failed") {
      toast.error("OAuth connection failed. Check your provider configuration and try again.");
      router.replace("/admin/integrations");
    }
  }, [router, searchParams]);

  const integrationMap = useMemo(
    () => new Map(integrations.map((integration) => [integration.key, integration])),
    [integrations]
  );

  const filteredDefinitions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return definitions.filter((definition) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        definition.name.toLowerCase().includes(normalizedSearch) ||
        definition.description.toLowerCase().includes(normalizedSearch) ||
        definition.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch));

      if (!matchesSearch) {
        return false;
      }

      if (tab === "all") {
        return true;
      }

      if (tab === "connected") {
        return integrationMap.get(definition.key)?.status === "connected";
      }

      return (
        categoryGroups
          .find((group) => group.id === tab)
          ?.categories.some((category) => category === definition.category) ?? false
      );
    });
  }, [definitions, integrationMap, search, tab]);

  const connectedCount = integrations.filter(
    (integration) => integration.status === "connected"
  ).length;
  const comingSoonCount = definitions.filter((definition) => definition.comingSoon).length;

  async function handleSave(
    definition: IntegrationDefinition,
    payload: {
      scope: "organization" | "business";
      config: Record<string, string>;
      secrets: Record<string, string>;
      assignedBusinessIds: string[];
    },
    testAfterSave: boolean
  ) {
    const response = await fetchWithCsrf("/api/admin/integrations", {
      method: "POST",
      body: JSON.stringify({
        key: definition.key,
        scope: payload.scope,
        config: payload.config,
        secrets: payload.secrets,
        assignedBusinessIds: payload.assignedBusinessIds
      })
    });
    const result = (await response.json()) as {
      error?: string;
      integration?: SafeIntegrationPayload;
    };

    const savedIntegration = result.integration;

    if (!response.ok || !savedIntegration) {
      throw new Error(result.error || "Unable to save integration.");
    }

    setIntegrations((current) => {
      const next = current.filter((item) => item.key !== savedIntegration.key);
      next.push(savedIntegration);
      return next.sort((left, right) => left.name.localeCompare(right.name));
    });

    toast.success(`${definition.name} connected successfully.`);

    let testResult: { success: boolean; message: string } | null = null;

    if (testAfterSave) {
      const testResponse = await fetchWithCsrf(
        `/api/admin/integrations/${savedIntegration.id}/test`,
        {
          method: "POST"
        }
      );
      const testPayload = (await testResponse.json()) as {
        success?: boolean;
        message?: string;
      };

      testResult = {
        success: Boolean(testPayload.success),
        message:
          testPayload.message ||
          (testPayload.success ? "Connection successful." : "Connection failed.")
      };
    }

    return {
      integration: savedIntegration,
      testResult
    };
  }

  async function handleDisconnect() {
    if (!disconnectTarget) {
      return;
    }

    const response = await fetchWithCsrf(
      `/api/admin/integrations/${disconnectTarget.id}`,
      {
        method: "DELETE"
      }
    );
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(result.error || "Unable to disconnect integration.");
    }

    setIntegrations((current) =>
      current.map((integration) =>
        integration.id === disconnectTarget.id
          ? {
              ...integration,
              status: "disconnected",
              hasSecrets: false,
              secretFieldCount: 0
            }
          : integration
      )
    );
    toast.success(`${disconnectTarget.name} disconnected.`);
    setDisconnectTarget(null);
  }

  async function handleTest(integration: SafeIntegrationPayload) {
    const response = await fetchWithCsrf(`/api/admin/integrations/${integration.id}/test`, {
      method: "POST"
    });
    const result = (await response.json()) as {
      success?: boolean;
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.error || result.message || "Connection test failed.");
    }

    if (result.success) {
      toast.success(result.message || "Connection successful.");
    } else {
      toast.error(result.message || "Connection test failed.");
    }
  }

  const selectedIntegration = selectedDefinition
    ? integrationMap.get(selectedDefinition.key) ?? null
    : null;

  function renderCards(definitionsToRender: IntegrationDefinition[]) {
    if (definitionsToRender.length === 0) {
      return (
        <EmptyState
          icon={<Plug className="h-6 w-6" />}
          title="No matching integrations"
          description="Try a different search or switch to another category."
        />
      );
    }

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {definitionsToRender.map((definition) => (
          <IntegrationCard
            key={definition.key}
            definition={definition}
            integration={integrationMap.get(definition.key)}
            onConnect={() => setSelectedDefinition(definition)}
            onDisconnect={() =>
              setDisconnectTarget(integrationMap.get(definition.key) ?? null)
            }
            onTest={() => {
              const integration = integrationMap.get(definition.key);
              if (integration) {
                void handleTest(integration);
              }
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="h-2.5 w-2.5 rounded-full bg-state-success" />
            <div className="text-sm text-ink-primary">{connectedCount} connected</div>
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4 text-sm text-ink-primary">
            {definitions.length} available
          </CardContent>
        </Card>
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="p-4 text-sm text-ink-primary">
            {comingSoonCount} coming soon
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border border-line-subtle bg-bg-surface p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search integrations..."
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap gap-1 rounded-2xl bg-bg-surface p-2">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="connected">Connected</TabsTrigger>
          {categoryGroups.map((group) => (
            <TabsTrigger key={group.id} value={group.id}>
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-8">
          {filteredDefinitions.length === 0 ? (
            <EmptyState
              icon={<Plug className="h-6 w-6" />}
              title="No matching integrations"
              description="Try a different search or switch to another category."
            />
          ) : (
            categoryGroups.map((group) => {
              const definitionsForGroup = filteredDefinitions.filter((definition) =>
                group.categories.some((category) => category === definition.category)
              );

              if (definitionsForGroup.length === 0) {
                return null;
              }

              return (
                <section key={group.id} className="space-y-4">
                  <h2 className="text-lg font-semibold text-white">{group.label}</h2>
                  {renderCards(definitionsForGroup)}
                </section>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="connected">
          {renderCards(filteredDefinitions)}
        </TabsContent>

        {categoryGroups.map((group) => (
          <TabsContent key={group.id} value={group.id}>
            {renderCards(filteredDefinitions)}
          </TabsContent>
        ))}
      </Tabs>

      <IntegrationConfigModal
        open={Boolean(selectedDefinition)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDefinition(null);
          }
        }}
        definition={selectedDefinition}
        integration={selectedIntegration}
        businesses={businesses}
        sessionRole={sessionRole}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(disconnectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDisconnectTarget(null);
          }
        }}
        title="Disconnect integration?"
        description={
          disconnectTarget
            ? `This will disconnect ${disconnectTarget.name} and wipe its stored secrets.`
            : ""
        }
        confirmLabel="Disconnect"
        variant="danger"
        onConfirm={() => void handleDisconnect()}
      />
    </div>
  );
}
