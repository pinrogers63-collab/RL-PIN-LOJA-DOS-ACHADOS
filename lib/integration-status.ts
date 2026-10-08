import { credentialsPresent, integrationRegistry } from "./integration-registry";
import { getStoredMercadoLivreToken } from "./mercadolivre";

export type RuntimeIntegrationStatus = {
  id: string;
  label: string;
  kind: string;
  required: boolean;
  future: boolean;
  configured: boolean;
  connected: boolean;
};

export async function getRuntimeIntegrationStatuses(): Promise<RuntimeIntegrationStatus[]> {
  let mercadoLivreConnected = false;
  try {
    mercadoLivreConnected = Boolean(await getStoredMercadoLivreToken());
  } catch {}

  return integrationRegistry.map((item) => {
    const configured = credentialsPresent(item);
    const connected = item.id === "mercado_livre" ? mercadoLivreConnected : configured;
    return {
      id: item.id,
      label: item.label,
      kind: item.kind,
      required: item.required,
      future: Boolean(item.future),
      configured,
      connected
    };
  });
}

export async function getRunnableMarketplaceStatuses() {
  const statuses = await getRuntimeIntegrationStatuses();
  return statuses.filter((item) => item.kind === "marketplace" && !item.future);
}
