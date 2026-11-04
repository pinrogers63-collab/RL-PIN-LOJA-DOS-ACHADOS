import { getSupabaseServiceRole } from "./supabase-server";

/**
 * Coleta automática de anúncios da Amazon via SP-API — CÓDIGO PRONTO,
 * AGUARDANDO A AUTO-AUTORIZAÇÃO DO USUÁRIO.
 *
 * O app SP-API existe (Production, Draft) e AMAZON_SP_API_CLIENT_ID /
 * AMAZON_SP_API_CLIENT_SECRET já estão configurados. Falta o passo que
 * só o titular pode fazer no Solution Provider Portal: a
 * auto-autorização do app na própria conta de vendedor, que gera o
 * refresh token LWA. Sem ele, nenhuma chamada SP-API é possível.
 *
 * Variável esperada (documentada aqui e no .env de exemplo do painel):
 *   AMAZON_SP_API_REFRESH_TOKEN — refresh token LWA da auto-autorização.
 * Opcionais:
 *   AMAZON_SELLER_ID       — ID do vendedor (merchant) na Amazon.
 *   AMAZON_MARKETPLACE_ID  — marketplace (padrão: Brasil A2Q3Y263D00KWC).
 *
 * Enquanto AMAZON_SP_API_REFRESH_TOKEN (ou AMAZON_SELLER_ID) estiver
 * ausente, collectAmazonListings faz NO-OP limpo: retorna
 * { ok: false, skipped: true, missing } sem nenhuma chamada de rede e
 * sem escrever no banco — nunca derruba o cron chamador.
 *
 * Com o token presente, o fluxo é: troca LWA (refresh_token →
 * access_token) → GET /listings/2021-08-01/items/{sellerId} paginado →
 * linhas em marketplace_trends (platform = "amazon", kind = "listing")
 * → promoção pela ponte genérica lib/product-promotion.ts.
 * ATENÇÃO: este caminho nunca rodou ao vivo (depende da autorização
 * acima); ele está coberto por testes com respostas simuladas.
 */

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";
const SP_API_BASE = "https://sellingpartnerapi-na.amazon.com";
const DEFAULT_MARKETPLACE_ID = "A2Q3Y263D00KWC"; // Amazon.com.br
const PAGE_SIZE = 20;
const MAX_PAGES = 10;
const AMAZON_KEYWORD = "anúncios da loja";

export type AmazonCollectConfig = {
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
  sellerId: string | null;
  marketplaceId: string;
  ready: boolean;
  missing: string[];
};

export function getAmazonCollectConfig(env: NodeJS.ProcessEnv = process.env): AmazonCollectConfig {
  const clientId = env.AMAZON_SP_API_CLIENT_ID || null;
  const clientSecret = env.AMAZON_SP_API_CLIENT_SECRET || null;
  const refreshToken = env.AMAZON_SP_API_REFRESH_TOKEN || null;
  const sellerId = env.AMAZON_SELLER_ID || null;
  const missing: string[] = [];
  if (!clientId) missing.push("AMAZON_SP_API_CLIENT_ID");
  if (!clientSecret) missing.push("AMAZON_SP_API_CLIENT_SECRET");
  if (!refreshToken) missing.push("AMAZON_SP_API_REFRESH_TOKEN");
  if (!sellerId) missing.push("AMAZON_SELLER_ID");
  return {
    clientId,
    clientSecret,
    refreshToken,
    sellerId,
    marketplaceId: env.AMAZON_MARKETPLACE_ID || DEFAULT_MARKETPLACE_ID,
    ready: missing.length === 0,
    missing
  };
}

export type AmazonListingSummary = {
  marketplaceId?: string;
  asin?: string;
  itemName?: string;
  status?: string[];
};

export type AmazonListingItem = {
  sku?: string;
  summaries?: AmazonListingSummary[];
};

type AmazonTrendRow = {
  platform: string;
  keyword: string;
  url: string | null;
  title: string | null;
  price: number | null;
  listing_id: string | null;
  kind: string;
  run_type: string;
  captured_at: string;
};

/**
 * Normaliza itens de GET /listings/2021-08-01/items em linhas de
 * marketplace_trends. listing_id = ASIN (ou SKU, se o ASIN faltar).
 * Preço NÃO vem nesse endpoint — sai null, nunca inventado. Função pura.
 */
export function mapAmazonListingsToTrendRows(
  items: AmazonListingItem[] | null | undefined,
  runType: string,
  capturedAt: string
): AmazonTrendRow[] {
  const list = Array.isArray(items) ? items : [];
  const rows: AmazonTrendRow[] = [];
  for (const item of list) {
    if (!item) continue;
    const summary = Array.isArray(item.summaries) ? item.summaries[0] : undefined;
    const listingId = summary?.asin || item.sku;
    const title = summary?.itemName;
    if (!listingId || typeof title !== "string" || title.trim().length === 0) continue;
    rows.push({
      platform: "amazon",
      keyword: AMAZON_KEYWORD,
      url: summary?.asin ? `https://www.amazon.com.br/dp/${summary.asin}` : null,
      title: title.trim().slice(0, 300),
      price: null,
      listing_id: listingId,
      kind: "listing",
      run_type: runType,
      captured_at: capturedAt
    });
  }
  return rows;
}

async function exchangeLwaAccessToken(config: AmazonCollectConfig): Promise<string> {
  const response = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken!,
      client_id: config.clientId!,
      client_secret: config.clientSecret!
    }),
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description ?? `LWA respondeu HTTP ${response.status}.`);
  }
  return data.access_token as string;
}

async function fetchAmazonListingItems(config: AmazonCollectConfig, accessToken: string): Promise<AmazonListingItem[]> {
  const items: AmazonListingItem[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`${SP_API_BASE}/listings/2021-08-01/items/${encodeURIComponent(config.sellerId!)}`);
    url.searchParams.set("marketplaceIds", config.marketplaceId);
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    url.searchParams.set("includedData", "summaries");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json", "x-amz-access-token": accessToken },
      cache: "no-store"
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.errors?.[0]?.message ?? `SP-API respondeu HTTP ${response.status}.`);
    }
    if (Array.isArray(data?.items)) items.push(...data.items);
    pageToken = data?.pagination?.nextToken;
    if (!pageToken) break;
  }
  return items;
}

/**
 * Coleta os anúncios da loja na Amazon. Sem a auto-autorização
 * (refresh token), é um no-op limpo e registrado no retorno — não é
 * erro e não escreve nada. Nunca lança.
 */
export async function collectAmazonListings(runType: "COLLECT" | "REFRESH" = "COLLECT") {
  const config = getAmazonCollectConfig();
  if (!config.ready) {
    return {
      ok: false,
      skipped: true,
      source: "amazon_sp_api_listings",
      kind: "own_store_listings",
      fetched: 0,
      stored: 0,
      missing: config.missing,
      error: `Amazon aguardando auto-autorização: defina ${config.missing.join(", ")} (o refresh token vem do Solution Provider Portal).`
    };
  }

  const supabase = getSupabaseServiceRole();
  const capturedAt = new Date().toISOString();
  try {
    const accessToken = await exchangeLwaAccessToken(config);
    const items = await fetchAmazonListingItems(config, accessToken);
    const rows = mapAmazonListingsToTrendRows(items, runType, capturedAt);

    if (rows.length > 0) {
      const { error } = await supabase.from("marketplace_trends").insert(rows);
      if (error) throw new Error(`Falha ao salvar anúncios da Amazon: ${error.message}`);
    }
    const { error: runError } = await supabase.from("marketplace_trend_runs").insert({
      run_type: runType,
      status: "SUCCESS",
      fetched: items.length,
      stored: rows.length,
      error: null
    });
    if (runError) throw new Error(`Falha ao registrar execução da Amazon: ${runError.message}`);

    return {
      ok: true,
      skipped: false,
      source: "amazon_sp_api_listings",
      kind: "own_store_listings",
      fetched: items.length,
      stored: rows.length,
      missing: [] as string[],
      error: undefined as string | undefined
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Erro inesperado.";
    try {
      await supabase.from("marketplace_trend_runs").insert({
        run_type: runType,
        status: "FAILED",
        fetched: 0,
        stored: 0,
        error: `amazon: ${reason}`.slice(0, 1000)
      });
    } catch { /* erro original retido */ }
    return {
      ok: false,
      skipped: false,
      source: "amazon_sp_api_listings",
      kind: "own_store_listings",
      fetched: 0,
      stored: 0,
      missing: [] as string[],
      error: reason
    };
  }
}
