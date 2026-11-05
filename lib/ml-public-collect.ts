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
 * Limites do catálogo: sem volume de vendas por anúncio (o ML só entrega
 * sold_quantity ao dono do anúncio) e um produto agrega vários
 * vendedores — o preço gravado é o do buy box (ou o piso da faixa).
 *
 * PENDENTE: liberar /sites/MLB/search via validação do app no ML
 * (revisão de segurança) e a validação ao vivo deste caminho (depende
 * de uma execução real com o token do projeto).
 */
export async function collectPublicListings(runType: "COLLECT" | "REFRESH" = "COLLECT") {
  const supabase = getSupabaseServiceRole();
  const keywords = parseTrendKeywords(process.env.ML_TREND_KEYWORDS);
  const capturedAt = new Date().toISOString();

  let fetched = 0;
  let stored = 0;
  const errors: string[] = [];

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
        let detailFailures = 0;
        for (const hit of hits) {
          try {
            const detail = await fetchCatalogProduct(hit.id!, accessToken);
            const row = mapCatalogProductToTrendRow(
              { ...detail, id: detail?.id ?? hit.id, name: detail?.name ?? hit.name },
              keyword,
              runType,
              capturedAt
            );
            if (row) rows.push(row);
          } catch {
            detailFailures += 1;
          }
        }
        if (detailFailures > 0) {
          errors.push(`${keyword}: ${detailFailures} detalhe(s) de produto falharam`);
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
