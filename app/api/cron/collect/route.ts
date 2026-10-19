import { collectMercadoLivreTrends } from "@/lib/marketplace-trends-collector";
import { collectPublicListings } from "@/lib/ml-public-collect";
import { getRunnableMarketplaceStatuses } from "@/lib/integration-status";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const connectors = await getRunnableMarketplaceStatuses();
  const mlConnected = connectors.some(c => c.id === "mercado_livre" && c.connected);

  // Coleta REAL via API pública (sem OAuth) — sempre executa.
  const publicListings = await collectPublicListings("COLLECT");

  // Tendências oficiais — somente com OAuth concluído.
  const mercadoLivreTrends = mlConnected
    ? await collectMercadoLivreTrends("COLLECT")
    : { ok: false, skipped: true, error: "Mercado Livre não autorizado." };

  return Response.json({
    ok: true,
    mode: "PUBLIC_LISTINGS_COLLECTION",
    publicListings,
    mercadoLivreTrends,
    at: new Date().toISOString(),
    connectors: connectors.map((c) => ({
      id: c.id,
      configured: c.configured,
      connected: c.connected,
      action: c.id === "mercado_livre"
        ? (publicListings.ok ? "public_listings_collected" : "public_listings_failed")
        : (c.connected ? "connector_pending_implementation" : "skipped_not_connected")
    })),
    note: "PENDENTE: catálogo do vendedor, preço/estoque em tempo real dos produtos cadastrados e publicação — todos requerem OAuth do Mercado Livre."
  });
}
