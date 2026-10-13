import { collectMercadoLivreTrends } from "@/lib/marketplace-trends-collector";
import { getRunnableMarketplaceStatuses } from "@/lib/integration-status";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const connectors = await getRunnableMarketplaceStatuses();
  const mlConnected = connectors.some(c=>c.id==="mercado_livre" && c.connected);
  const mercadoLivreTrends = mlConnected
    ? await collectMercadoLivreTrends("REFRESH")
    : {ok:false,skipped:true,error:"Mercado Livre não autorizado."};
  return Response.json({
    ok: true,
    mode: "OFFICIAL_TRENDS_COLLECTION",
    mercadoLivreTrends,
    at: new Date().toISOString(),
    tasks: connectors.map((c) => ({
      connector: c.id,
      configured: c.configured,
      connected: c.connected,
      action: c.id==="mercado_livre" ? (mercadoLivreTrends.ok ? "trends_refreshed" : "trends_failed_or_skipped") : (c.connected ? "connector_pending_implementation" : "skipped_not_connected"),
      refresh: c.id==="mercado_livre" ? ["trend"] : []
    }))
  });
}
