import { BatchDataProvider } from "@/lib/dealhawk/providers/batchdata";
import { DemoProvider } from "@/lib/dealhawk/providers/demo";
import type {
  PropertySearchProvider,
  ProviderKey,
} from "@/lib/dealhawk/providers/types";
import { db } from "@/lib/db";

/**
 * Dealhawk Empire — provider resolver.
 *
 * Resolves a ProviderKey to a concrete PropertySearchProvider instance,
 * wiring in per-business credentials from Business.currentIntegrations
 * when available. The demo provider is always available with no
 * credentials; the BatchData provider reads from env or the integrations
 * blob and throws a clear error if neither is set.
 */

export type DealhawkIntegrations = {
  batchdata?: {
    apiKey?: string;
    baseUrl?: string;
  };
};

/**
 * Return the set of enabled providers for a business. Demo is always
 * first (so the UI renders it as the default), followed by any live
 * providers with credentials available.
 */
export async function listProvidersForBusiness(
  businessId: string
): Promise<{ key: ProviderKey; label: string; configured: boolean }[]> {
  const integrations = await loadIntegrations(businessId);
  const providers: PropertySearchProvider[] = [
    new DemoProvider(),
    new BatchDataProvider(integrations?.batchdata),
  ];
  return providers.map((p) => ({
    key: p.key,
    label: p.label,
    configured: p.isConfigured(),
  }));
}

/**
 * Materialize a provider instance for the given business + key. Callers
 * are responsible for handling ProviderCredentialError if they invoke
 * search / skipTrace without a configured provider.
 */
export async function getProviderForBusiness(
  businessId: string,
  key: ProviderKey
): Promise<PropertySearchProvider> {
  const integrations = await loadIntegrations(businessId);
  switch (key) {
    case "demo":
      return new DemoProvider();
    case "batchdata":
      return new BatchDataProvider(integrations?.batchdata);
  }
}

async function loadIntegrations(
  businessId: string
): Promise<DealhawkIntegrations | null> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { currentIntegrations: true },
  });
  if (!business?.currentIntegrations) return null;
  if (
    typeof business.currentIntegrations !== "object" ||
    Array.isArray(business.currentIntegrations)
  ) {
    return null;
  }
  return business.currentIntegrations as DealhawkIntegrations;
}
