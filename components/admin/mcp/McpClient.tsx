"use client";

import { useMemo, useState } from "react";
import { Cpu } from "lucide-react";

import type { McpDefinition } from "@/lib/integrations/mcp-definitions";
import type { SafeIntegrationPayload, SafeMcpServerPayload } from "@/lib/integrations/safe";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { McpDefinitionCard } from "@/components/admin/mcp/McpDefinitionCard";
import { McpInstallModal } from "@/components/admin/mcp/McpInstallModal";
import { McpServerCard } from "@/components/admin/mcp/McpServerCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";

type McpClientProps = {
  definitions: McpDefinition[];
  servers: SafeMcpServerPayload[];
  integrations: SafeIntegrationPayload[];
  businesses: Array<{ id: string; name: string }>;
  sessionRole: "super_admin" | "admin";
};

const categories = [
  { id: "all", label: "All" },
  { id: "search", label: "Search" },
  { id: "data", label: "Data" },
  { id: "communication", label: "Communication" },
  { id: "social", label: "Social Media" },
  { id: "developer", label: "Developer" },
  { id: "productivity", label: "Productivity" },
  { id: "ai", label: "AI" }
] as const;

export function McpClient({
  definitions,
  servers: initialServers,
  integrations,
  businesses,
  sessionRole
}: McpClientProps) {
  const [servers, setServers] = useState(initialServers);
  const [tab, setTab] = useState<(typeof categories)[number]["id"]>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<SafeMcpServerPayload | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SafeMcpServerPayload | null>(null);

  const installedDefinitionIds = new Set(servers.map((server) => server.definitionId));
  const businessMap = new Map(businesses.map((business) => [business.id, business.name]));
  const visibleDefinitions = definitions.filter(
    (definition) => tab === "all" || definition.category === tab
  );

  const integrationMap = useMemo(
    () => new Map(integrations.map((integration) => [integration.key, integration])),
    [integrations]
  );

  async function handleSave(payload: {
    definitionId: string;
    name: string;
    businessId?: string;
    config: Record<string, string>;
    secrets: Record<string, string>;
    serverId?: string;
  }) {
    const endpoint = payload.serverId
      ? `/api/admin/mcp/${payload.serverId}`
      : "/api/admin/mcp";
    const response = await fetchWithCsrf(endpoint, {
      method: payload.serverId ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    const result = (await response.json()) as {
      error?: string;
      server?: SafeMcpServerPayload;
    };

    const savedServer = result.server;

    if (!response.ok || !savedServer) {
      throw new Error(result.error || "Unable to save MCP server.");
    }

    setServers((current) => {
      const next = current.filter((server) => server.id !== savedServer.id);
      next.push(savedServer);
      return next.sort((left, right) => left.name.localeCompare(right.name));
    });

    toast.success(
      payload.serverId ? "MCP server updated." : "MCP server installed."
    );
  }

  async function handleRemove() {
    if (!removeTarget) {
      return;
    }

    const response = await fetchWithCsrf(`/api/admin/mcp/${removeTarget.id}`, {
      method: "DELETE"
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(result.error || "Unable to remove MCP server.");
    }

    setServers((current) => current.filter((server) => server.id !== removeTarget.id));
    toast.success("MCP server removed.");
    setRemoveTarget(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => {
            setSelectedServer(null);
            setSelectedDefinitionId(null);
            setModalOpen(true);
          }}
        >
          Install MCP Server
        </Button>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/10 px-4 py-4 text-sm leading-6 text-slate-200">
          MCP servers extend your agents with new capabilities - web search, database access, CRM tools, and more. Install one below to get started.
        </div>
      ) : null}

      {servers.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Installed</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            {servers.map((server) => (
              <McpServerCard
                key={server.id}
                server={server}
                definition={server.definition!}
                businessName={server.businessId ? businessMap.get(server.businessId) : null}
                onConfigure={() => {
                  setSelectedServer(server);
                  setSelectedDefinitionId(server.definitionId);
                  setModalOpen(true);
                }}
                onRemove={() => setRemoveTarget(server)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Available to install</h2>

        <Tabs value={tab} onValueChange={(value) => setTab(value as (typeof categories)[number]["id"])}>
          <TabsList className="h-auto flex-wrap gap-1 rounded-2xl bg-ghost-surface p-2">
            {categories.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category.id} value={category.id}>
              {visibleDefinitions.length === 0 ? (
                <EmptyState
                  icon={<Cpu className="h-6 w-6" />}
                  title="No MCP servers in this category"
                  description="Try another category to explore available capabilities."
                />
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {visibleDefinitions.map((definition) => {
                    const dependency = definition.requiresIntegration
                      ? integrationMap.get(definition.requiresIntegration)
                      : null;
                    const dependencyMissing =
                      Boolean(definition.requiresIntegration) &&
                      (!dependency || dependency.status !== "connected");

                    return (
                      <McpDefinitionCard
                        key={definition.id}
                        definition={definition}
                        isInstalled={installedDefinitionIds.has(definition.id)}
                        dependencyMissing={dependencyMissing}
                        dependencyLabel={dependency?.name || definition.requiresIntegration}
                        onInstall={() => {
                          setSelectedDefinitionId(definition.id);
                          setSelectedServer(null);
                          setModalOpen(true);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <McpInstallModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setSelectedServer(null);
            setSelectedDefinitionId(null);
          }
        }}
        definitions={definitions}
        businesses={businesses}
        integrations={integrations}
        sessionRole={sessionRole}
        server={selectedServer}
        initialDefinitionId={selectedDefinitionId}
        onInstall={handleSave}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRemoveTarget(null);
          }
        }}
        title="Remove MCP server?"
        description={
          removeTarget
            ? `This will permanently remove ${removeTarget.name} from Mission Control.`
            : ""
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => void handleRemove()}
      />
    </div>
  );
}
