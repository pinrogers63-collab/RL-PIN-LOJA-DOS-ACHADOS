import { collectMercadoLivreTrends } from "@/lib/marketplace-trends-collector";
import { collectPublicListings } from "@/lib/ml-public-collect";
import { collectShopeeShopItems } from "@/lib/shopee-collect";
import { collectAmazonListings } from "@/lib/amazon-collect";
import { promoteStoredListings } from "@/lib/product-promotion";
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
  const shopeeConnected = connectors.some(c=>c.id==="shopee" && c.connected);

  // Coleta REAL de listagens via busca autenticada (OAuth) — mesmo ritmo
  // do cron de coleta, para a ponte de promoção ter linhas kind="listing"
  // frescas também no refresh.
  const publicListings = await collectPublicListings("REFRESH");

  const mercadoLivreTrends = mlConnected
    ? await collectMercadoLivreTrends("REFRESH")
    : {ok:false,skipped:true,error:"Mercado Livre não autorizado."};

  // Itens da própria loja na Shopee — mesmo ritmo do cron de coleta.
  const shopeeListings = shopeeConnected
    ? await collectShopeeShopItems("REFRESH")
    : {ok:false,skipped:true,error:"Shopee não autorizada."};

  // Amazon: no-op limpo enquanto faltar a auto-autorização (refresh token).
  const amazonListings = await collectAmazonListings("REFRESH");

  // PONTE AUTOMÁTICA: promove as listagens armazenadas (todas as
  // plataformas, inclusive de execuções anteriores) para `products`.
  const promotion = await promoteStoredListings();

  return Response.json({
    ok: true,
    mode: "OFFICIAL_TRENDS_COLLECTION",
    publicListings,
    mercadoLivreTrends,
    shopeeListings,
    amazonListings,
    promotion,
    at: new Date().toISOString(),
    tasks: connectors.map((c) => ({
      connector: c.id,
      configured: c.configured,
      connected: c.connected,
      action: c.id==="mercado_livre" ? (mercadoLivreTrends.ok ? "trends_refreshed" : "trends_failed_or_skipped") : (c.connected ? "connector_pending_implementation" : "skipped_not_connected"),
      refresh: c.id==="mercado_livre" ? ["trend", "listing"] : []
    }))
  });
}
