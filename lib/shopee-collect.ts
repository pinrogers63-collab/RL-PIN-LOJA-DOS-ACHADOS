import { getSupabaseServiceRole } from "./supabase-server";
import { getShopeeConfig, getValidShopeeAccessToken, signShopeeShopRequest } from "./shopee";

/**
 * Coleta automática dos itens da PRÓPRIA loja na Shopee (rolipin67).
 *
 * Usa o token persistido da loja autorizada (com renovação automática
 * via getValidShopeeAccessToken) e a API v2 oficial:
 *   get_item_list (paginado) → get_item_base_info (lotes de 50).
 *
 * As linhas são gravadas em marketplace_trends no MESMO formato dos
 * anúncios do Mercado Livre (kind = "listing", platform = "shopee",
 * listing_id = item_id) e a execução é registrada em
 * marketplace_trend_runs. A promoção para `products` é feita pela
 * ponte genérica lib/product-promotion.ts, chamada no fim dos crons.
 *
 * Honestidade: coleta apenas itens da loja do próprio usuário — hoje
 * a loja tem ZERO itens cadastrados, então uma execução correta pode
 * legitimamente retornar fetched/stored = 0.
 */

const SHOPEE_API_BASE = "https://partner.shopeemobile.com";
const SHOPEE_ITEM_LIST_PATH = "/api/v2/product/get_item_list";
const SHOPEE_ITEM_BASE_INFO_PATH = "/api/v2/product/get_item_base_info";

const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const SHOPEE_KEYWORD = "itens da loja";

export type ShopeeItemListPage = {
  itemIds: number[];
  hasNextPage: boolean;
  nextOffset: number;
  totalCount: number | null;
};

export type ShopeeItemInfo = {
  item_id?: number;
  item_name?: string;
  item_status?: string;
  price_info?: Array<{ current_price?: number; original_price?: number }>;
};

type ShopeeTrendRow = {
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

/** Extrai ids + paginação da resposta de get_item_list. Função pura. */
export function parseShopeeItemListPage(data: any): ShopeeItemListPage {
  const response = data?.response ?? {};
  const items = Array.isArray(response.item) ? response.item : [];
  const itemIds = items
    .map((item: any) => Number(item?.item_id))
    .filter((id: number) => Number.isInteger(id) && id > 0);
  return {
    itemIds,
    hasNextPage: Boolean(response.has_next_page),
    nextOffset: Number.isFinite(Number(response.next_offset)) ? Number(response.next_offset) : 0,
    totalCount: Number.isFinite(Number(response.total_count)) ? Number(response.total_count) : null
  };
}

/** URL pública do item na Shopee (padrão product/{shop_id}/{item_id}). */
export function buildShopeeItemUrl(shopId: number, itemId: number) {
  return `https://shopee.com.br/product/${shopId}/${itemId}`;
}

/**
 * Normaliza itens de get_item_base_info em linhas de marketplace_trends
 * (mesmo formato dos anúncios públicos do ML). Função pura.
 */
export function mapShopeeItemsToTrendRows(
  items: ShopeeItemInfo[] | null | undefined,
  shopId: number,
  runType: string,
  capturedAt: string
): ShopeeTrendRow[] {
  const list = Array.isArray(items) ? items : [];
  return list
    .filter((item) => item && Number.isInteger(item.item_id) && typeof item.item_name === "string" && item.item_name.trim().length > 0)
    .map((item) => {
      const currentPrice = item.price_info?.[0]?.current_price;
      return {
        platform: "shopee",
        keyword: SHOPEE_KEYWORD,
        url: buildShopeeItemUrl(shopId, item.item_id!),
        title: item.item_name!.trim().slice(0, 300),
        price: typeof currentPrice === "number" && Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null,
        listing_id: String(item.item_id),
        kind: "listing",
        run_type: runType,
        captured_at: capturedAt
      };
    });
}

function buildShopeeProductUrl(
  path: string,
  accessToken: string,
  shopId: number,
  params: Record<string, string>,
  timestamp = Math.floor(Date.now() / 1000)
) {
  const { partnerId, partnerKey } = getShopeeConfig();
  const sign = signShopeeShopRequest(partnerId, path, timestamp, accessToken, shopId, partnerKey);
  const url = new URL(`${SHOPEE_API_BASE}${path}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("shop_id", String(shopId));
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("sign", sign);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

async function shopeeGet(path: string, accessToken: string, shopId: number, params: Record<string, string>) {
  const response = await fetch(buildShopeeProductUrl(path, accessToken, shopId, params), {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.message ?? `Shopee respondeu HTTP ${response.status}.`);
  }
  return data;
}

async function fetchAllItemIds(accessToken: string, shopId: number): Promise<number[]> {
  const ids: number[] = [];
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const data = await shopeeGet(SHOPEE_ITEM_LIST_PATH, accessToken, shopId, {
      offset: String(offset),
      page_size: String(PAGE_SIZE),
      item_status: "NORMAL"
    });
    const parsed = parseShopeeItemListPage(data);
    ids.push(...parsed.itemIds);
    if (!parsed.hasNextPage || parsed.itemIds.length === 0) break;
    offset = parsed.nextOffset;
  }
  return ids;
}

async function fetchItemsBaseInfo(accessToken: string, shopId: number, itemIds: number[]): Promise<ShopeeItemInfo[]> {
  const items: ShopeeItemInfo[] = [];
  for (let i = 0; i < itemIds.length; i += PAGE_SIZE) {
    const chunk = itemIds.slice(i, i + PAGE_SIZE);
    const data = await shopeeGet(SHOPEE_ITEM_BASE_INFO_PATH, accessToken, shopId, {
      item_id_list: chunk.join(",")
    });
    const list = data?.response?.item_list;
    if (Array.isArray(list)) items.push(...list);
  }
  return items;
}

/**
 * Coleta os itens da loja e os grava como listagens. Nunca lança:
 * falha vira { ok: false, error } (mesmo padrão do coletor de
 * tendências do ML) para não derrubar o cron chamador.
 */
export async function collectShopeeShopItems(runType: "COLLECT" | "REFRESH" = "COLLECT") {
  const supabase = getSupabaseServiceRole();
  const capturedAt = new Date().toISOString();

  try {
    const { accessToken, shopId } = await getValidShopeeAccessToken();
    const itemIds = await fetchAllItemIds(accessToken, shopId);
    const items = itemIds.length > 0 ? await fetchItemsBaseInfo(accessToken, shopId, itemIds) : [];
    const rows = mapShopeeItemsToTrendRows(items, shopId, runType, capturedAt);

    if (rows.length > 0) {
      const { error } = await supabase.from("marketplace_trends").insert(rows);
      if (error) throw new Error(`Falha ao salvar itens da Shopee: ${error.message}`);
    }

    const { error: runError } = await supabase.from("marketplace_trend_runs").insert({
      run_type: runType,
      status: "SUCCESS",
      fetched: itemIds.length,
      stored: rows.length,
      error: null
    });
    if (runError) throw new Error(`Falha ao registrar execução da Shopee: ${runError.message}`);

    return {
      ok: true,
      source: "shopee_shop_items",
      kind: "own_shop_listings",
      shopId,
      fetched: itemIds.length,
      stored: rows.length,
      errors: [] as string[]
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Erro inesperado.";
    try {
      await supabase.from("marketplace_trend_runs").insert({
        run_type: runType,
        status: "FAILED",
        fetched: 0,
        stored: 0,
        error: `shopee: ${reason}`.slice(0, 1000)
      });
    } catch { /* erro original retido */ }
    return {
      ok: false,
      source: "shopee_shop_items",
      kind: "own_shop_listings",
      fetched: 0,
      stored: 0,
      errors: [reason]
    };
  }
}
