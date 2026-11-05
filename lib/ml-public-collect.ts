import { getSupabaseServiceRole } from "@/lib/supabase-server";
import { getValidMercadoLivreToken, mercadoLivreGet } from "@/lib/mercadolivre";

const ML_CATALOG_SEARCH_PATH = "/products/search";
const ML_CATALOG_PRODUCT_PATH = "/products";
const DEFAULT_KEYWORDS = "ofertas do dia,mais vendidos,eletrônicos";
const MAX_KEYWORDS = 8;
const RESULTS_PER_KEYWORD = 20;

export type CatalogSearchHit = {
  id?: string;
  name?: string;
  domain_id?: string;
};

export type CatalogBuyBoxWinner = {
  item_id?: string;
  price?: number;
  seller_id?: number | string;
  currency_id?: string;
};

export type CatalogPriceRange = {
  min_price?: number;
  max_price?: number;
};

export type CatalogProduct = {
  id?: string;
  name?: string;
  permalink?: string;
  buy_box_winner?: CatalogBuyBoxWinner | null;
  buy_box_winner_price_range?: CatalogPriceRange | null;
  min_price?: number;
  max_price?: number;
};

/**
 * Oferta individual de um produto de catálogo (GET /products/{id}/items).
 * Cada oferta é um anúncio concreto de um vendedor, com preço próprio.
 */
export type CatalogItemOffer = {
  item_id?: string;
  id?: string;
  price?: number;
  permalink?: string;
  seller_id?: number | string;
};

export type CatalogItemsResponse = {
  results?: CatalogItemOffer[];
};

type TrendRow = {
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
 * Lê a lista de palavras-chave de ML_TREND_KEYWORDS (separadas por vírgula).
 * Usa padrões quando a variável está ausente. Limita a MAX_KEYWORDS itens.
 */
export function parseTrendKeywords(raw: string | undefined): string[] {
  const source = raw && raw.trim().length > 0 ? raw : DEFAULT_KEYWORDS;
  return source
    .split(",")
    .map((k) => k.trim().slice(0, 100))
    .filter((k) => k.length >= 2)
    .slice(0, MAX_KEYWORDS);
}

/**
 * Normaliza o retorno da busca de catálogo (GET /products/search),
 * mantendo só os produtos com id utilizável. Função pura.
 */
export function mapCatalogSearchHits(
  data: { results?: CatalogSearchHit[] } | null | undefined
): CatalogSearchHit[] {
  const results = Array.isArray(data?.results) ? data!.results! : [];
  return results.filter((r) => r && typeof r.id === "string" && r.id.trim().length > 0);
}

function validPrice(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Preço representativo do produto de catálogo, em ordem de preferência:
 * 1) preço do vencedor do buy box (a oferta que o ML destaca);
 * 2) menor preço da faixa do buy box;
 * 3) menor preço do produto.
 * Retorna null quando nenhuma fonte traz preço válido.
 */
export function resolveCatalogPrice(product: CatalogProduct): number | null {
  return (
    validPrice(product.buy_box_winner?.price) ??
    validPrice(product.buy_box_winner_price_range?.min_price) ??
    validPrice(product.min_price)
  );
}

/**
 * Normaliza o retorno de GET /products/{id}/items, mantendo só as
 * ofertas que são objetos utilizáveis. Função pura.
 */
export function mapCatalogItemOffers(
  data: CatalogItemsResponse | null | undefined
): CatalogItemOffer[] {
  const results = Array.isArray(data?.results) ? data!.results! : [];
  return results.filter((r) => r !== null && typeof r === "object");
}

/**
 * Primeira oferta com preço válido (> 0), na ordem retornada pela API.
 * Retorna null quando nenhuma oferta traz preço. Função pura.
 */
export function firstPricedCatalogOffer(offers: CatalogItemOffer[]): CatalogItemOffer | null {
  for (const offer of offers) {
    if (validPrice(offer?.price) !== null) return offer;
  }
  return null;
}

/**
 * Aplica uma oferta de /items sobre o produto de catálogo, como se ela
 * fosse o buy box: o preço (e o item, quando a oferta o traz) passa a ser
 * a fonte primária de resolveCatalogPrice/mapCatalogProductToTrendRow,
 * e o permalink da oferta — quando existe — substitui o do produto
 * (aponta direto para o anúncio concreto). Usado só quando o detalhe do
 * produto não trouxe preço em nenhuma fonte. Função pura.
 */
export function applyCatalogOffer(product: CatalogProduct, offer: CatalogItemOffer): CatalogProduct {
  const offerItemId =
    (typeof offer.item_id === "string" && offer.item_id.trim().length > 0 ? offer.item_id.trim() : null) ??
    (typeof offer.id === "string" && offer.id.trim().length > 0 ? offer.id.trim() : null);
  return {
    ...product,
    permalink:
      typeof offer.permalink === "string" && offer.permalink.trim().length > 0
        ? offer.permalink
        : product.permalink,
    buy_box_winner: {
      ...product.buy_box_winner,
      item_id: offerItemId ?? product.buy_box_winner?.item_id,
      price: validPrice(offer.price) ?? undefined,
      seller_id: offer.seller_id ?? product.buy_box_winner?.seller_id
    }
  };
}

/**
 * Motivos de descarte de um hit da busca que NÃO virou linha gravada.
 * A distinção importa para diagnóstico (foi o que faltou no run real de
 * 05/11/2026: fetched=60, stored=0, erro NULL — descarte mudo):
 *  - detailFailed: GET /products/{id} falhou (HTTP/erro);
 *  - noPrice: detalhe ok, mas sem preço em nenhuma fonte — nem no
 *    detalhe, nem em /items (lista de ofertas vazia ou chamada falhou);
 *  - offerNoPrice: /items respondeu com ofertas, mas nenhuma com preço;
 *  - invalid: detalhe sem id ou sem nome utilizável.
 */
export type CatalogDiscardStats = {
  detailFailed: number;
  noPrice: number;
  offerNoPrice: number;
  invalid: number;
};

export function emptyDiscardStats(): CatalogDiscardStats {
  return { detailFailed: 0, noPrice: 0, offerNoPrice: 0, invalid: 0 };
}

export function totalDiscards(stats: CatalogDiscardStats): number {
  return stats.detailFailed + stats.noPrice + stats.offerNoPrice + stats.invalid;
}

/**
 * Resumo contável dos descartes para o campo error do run, ex.:
 * "descartados: 60 (sem preço: 45, detalhe falhou: 15)".
 * Só inclui os motivos com contagem > 0; null quando não houve descarte.
 */
export function formatDiscardSummary(stats: CatalogDiscardStats): string | null {
  const total = totalDiscards(stats);
  if (total === 0) return null;
  const parts: string[] = [];
  if (stats.noPrice > 0) parts.push(`sem preço: ${stats.noPrice}`);
  if (stats.offerNoPrice > 0) parts.push(`oferta sem preço: ${stats.offerNoPrice}`);
  if (stats.detailFailed > 0) parts.push(`detalhe falhou: ${stats.detailFailed}`);
  if (stats.invalid > 0) parts.push(`sem id/nome: ${stats.invalid}`);
  return `descartados: ${total} (${parts.join(", ")})`;
}

/**
 * Converte um produto de catálogo (GET /products/{id}) em linha de
 * marketplace_trends no MESMO formato das listagens anteriores
 * (kind = "listing"), para a ponte de promoção seguir intacta:
 *  - listing_id = item_id do vencedor do buy box; sem vencedor, o id
 *    do próprio produto de catálogo (identidade estável do produto);
 *  - sem preço em nenhuma fonte, o produto é DESCARTADO (retorna null),
 *    porque a promoção exige preço — preço nunca é inventado.
 * Função pura — testável sem rede nem banco.
 */
export function mapCatalogProductToTrendRow(
  product: CatalogProduct | null | undefined,
  keyword: string,
  runType: string,
  capturedAt: string
): TrendRow | null {
  if (!product) return null;
  const catalogId = typeof product.id === "string" ? product.id.trim() : "";
  const title = typeof product.name === "string" ? product.name.trim() : "";
  if (catalogId.length === 0 || title.length === 0) return null;

  const price = resolveCatalogPrice(product);
  if (price === null) return null;

  const winnerItemId =
    typeof product.buy_box_winner?.item_id === "string" && product.buy_box_winner.item_id.trim().length > 0
      ? product.buy_box_winner.item_id.trim()
      : null;

  return {
    platform: "mercado_livre",
    keyword,
    url: typeof product.permalink === "string" && product.permalink.trim().length > 0 ? product.permalink : null,
    title: title.slice(0, 300),
    price,
    listing_id: winnerItemId ?? catalogId,
    kind: "listing",
    run_type: runType,
    captured_at: capturedAt
  };
}

async function fetchCatalogSearch(keyword: string, accessToken: string) {
  return mercadoLivreGet<{ results?: CatalogSearchHit[] }>(
    `${ML_CATALOG_SEARCH_PATH}?site_id=MLB&q=${encodeURIComponent(keyword)}&status=active&limit=${RESULTS_PER_KEYWORD}`,
    accessToken
  );
}

async function fetchCatalogProduct(catalogId: string, accessToken: string) {
  return mercadoLivreGet<CatalogProduct>(
    `${ML_CATALOG_PRODUCT_PATH}/${encodeURIComponent(catalogId)}`,
    accessToken
  );
}

async function fetchCatalogProductItems(catalogId: string, accessToken: string) {
  return mercadoLivreGet<CatalogItemsResponse>(
    `${ML_CATALOG_PRODUCT_PATH}/${encodeURIComponent(catalogId)}/items`,
    accessToken
  );
}

/**
 * Coleta REAL de listagens via API de Catálogo do Mercado Livre.
 *
 * Por que não a busca do site (/sites/MLB/search)? Desde o endurecimento
 * da API do ML (2024), busca e itens de terceiros só respondem para apps
 * que passaram pela revisão de segurança/validação do ML; apps comuns
 * recebem HTTP 403 "forbidden" mesmo com OAuth válido. A API de Catálogo
 * (/products/*) funciona com o mesmo token já autorizado — é a rota
 * oficial disponível hoje para garimpo de produtos do marketplace.
 *
 * Fluxo por palavra-chave: GET /products/search (produtos de catálogo
 * ativos) → GET /products/{id} nos principais resultados (nome,
 * permalink, buy box) → linhas kind="listing" em marketplace_trends →
 * promoção pela ponte genérica (lib/product-promotion.ts). A execução é
 * registrada em marketplace_trend_runs com fetched/stored/erros reais;
 * falha total vira run FAILED com a mensagem — nunca silêncio.
 *
 * Resolução de preço v2: a validação ao vivo (05/11/2026) mostrou a
 * busca funcionando (fetched=60), mas os detalhes voltaram SEM preço em
 * todas as fontes do produto (buy box/faixa/piso) — stored=0. Quando o
 * detalhe não traz preço, o coletor busca as ofertas individuais em
 * GET /products/{id}/items e usa a primeira com preço válido; se a
 * oferta traz item_id/permalink próprios, eles alimentam a linha.
 * E todo hit não gravado entra na telemetria de descarte
 * (formatDiscardSummary), registrada no campo error do run mesmo em
 * SUCCESS — descarte nunca é mudo.
 *
 * Limites do catálogo: sem volume de vendas por anúncio (o ML só entrega
 * sold_quantity ao dono do anúncio) e um produto agrega vários
 * vendedores — o preço gravado é o do buy box (ou o piso da faixa).
 *
 * PENDENTE: liberar /sites/MLB/search via validação do app no ML
 * (revisão de segurança).
 */
export async function collectPublicListings(runType: "COLLECT" | "REFRESH" = "COLLECT") {
  const supabase = getSupabaseServiceRole();
  const keywords = parseTrendKeywords(process.env.ML_TREND_KEYWORDS);
  const capturedAt = new Date().toISOString();

  let fetched = 0;
  let stored = 0;
  const errors: string[] = [];
  const discards = emptyDiscardStats();

  let accessToken: string | null = null;
  try {
    accessToken = await getValidMercadoLivreToken();
  } catch (error) {
    errors.push(`autenticação: ${error instanceof Error ? error.message : "erro inesperado"}`);
  }

  if (accessToken) {
    for (const keyword of keywords) {
      try {
        const data = await fetchCatalogSearch(keyword, accessToken);
        const hits = mapCatalogSearchHits(data);
        fetched += hits.length;

        const rows: TrendRow[] = [];
        for (const hit of hits) {
          let detail: CatalogProduct;
          try {
            const raw = await fetchCatalogProduct(hit.id!, accessToken);
            detail = { ...(raw ?? {}), id: raw?.id ?? hit.id, name: raw?.name ?? hit.name };
          } catch {
            discards.detailFailed += 1;
            continue;
          }

          const catalogId = typeof detail.id === "string" ? detail.id.trim() : "";
          const title = typeof detail.name === "string" ? detail.name.trim() : "";
          if (catalogId.length === 0 || title.length === 0) {
            discards.invalid += 1;
            continue;
          }

          let row = mapCatalogProductToTrendRow(detail, keyword, runType, capturedAt);
          if (!row) {
            // Detalhe ok, mas sem preço em nenhuma fonte do produto:
            // tenta as ofertas individuais (GET /products/{id}/items) —
            // é nelas que o preço por anúncio costuma vir.
            let offers: CatalogItemOffer[] | null = null;
            try {
              offers = mapCatalogItemOffers(await fetchCatalogProductItems(catalogId, accessToken));
            } catch {
              offers = null; // /items falhou: conta como "sem preço" abaixo
            }
            const priced = offers ? firstPricedCatalogOffer(offers) : null;
            if (priced) {
              row = mapCatalogProductToTrendRow(applyCatalogOffer(detail, priced), keyword, runType, capturedAt);
            }
            if (!row) {
              if (offers && offers.length > 0 && !priced) discards.offerNoPrice += 1;
              else discards.noPrice += 1;
              continue;
            }
          }
          rows.push(row);
        }

        if (rows.length > 0) {
          const { error } = await supabase.from("marketplace_trends").insert(rows);
          if (error) throw new Error(`Falha ao salvar tendências: ${error.message}`);
          stored += rows.length;
        }
      } catch (error) {
        errors.push(`${keyword}: ${error instanceof Error ? error.message : "erro inesperado"}`);
      }
    }
  }

  // Telemetria de descarte: se algo foi buscado e não foi gravado, o
  // resumo dos motivos entra no error do run (mesmo em SUCCESS) — o
  // descarte nunca é mudo. Com stored=0 e descartes, errors não fica
  // vazio e o run vira FAILED com a mensagem (falha total visível).
  if (stored < fetched) {
    const summary = formatDiscardSummary(discards);
    if (summary) errors.push(summary);
  }

  const status = stored > 0 ? "SUCCESS" : errors.length > 0 ? "FAILED" : "SUCCESS";
  await supabase.from("marketplace_trend_runs").insert({
    run_type: runType,
    status,
    fetched,
    stored,
    error: errors.length > 0 ? errors.join(" | ").slice(0, 1000) : null
  });

  return {
    ok: status === "SUCCESS",
    source: "mercado_livre_catalog_products",
    kind: "catalog_listings_oauth",
    keywords,
    fetched,
    stored,
    errors
  };
}
