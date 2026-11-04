import { getSupabaseServiceRole } from "@/lib/supabase-server";
import { getValidMercadoLivreToken, mercadoLivreGet } from "@/lib/mercadolivre";

const ML_SITE_SEARCH_PATH = "/sites/MLB/search";
const DEFAULT_KEYWORDS = "ofertas do dia,mais vendidos,eletrônicos";
const MAX_KEYWORDS = 8;
const RESULTS_PER_KEYWORD = 20;

export type PublicListing = {
  id?: string;
  title?: string;
  price?: number;
  permalink?: string;
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
 * Normaliza o retorno da API pública de busca em linhas da tabela
 * marketplace_trends. Função pura — testável sem rede nem banco.
 */
export function mapPublicSearchResults(
  data: { results?: PublicListing[] } | null | undefined,
  keyword: string,
  runType: string,
  capturedAt: string
): TrendRow[] {
  const results = Array.isArray(data?.results) ? data!.results! : [];
  return results
    .filter((r) => r && typeof r.id === "string" && typeof r.title === "string")
    .map((r) => ({
      platform: "mercado_livre",
      keyword,
      url: typeof r.permalink === "string" ? r.permalink : null,
      title: r.title!.slice(0, 300),
      price: typeof r.price === "number" && Number.isFinite(r.price) ? r.price : null,
      listing_id: r.id!,
      kind: "listing",
      run_type: runType,
      captured_at: capturedAt
    }));
}

async function fetchAuthenticatedSearch(keyword: string, accessToken: string) {
  return mercadoLivreGet<{ results?: PublicListing[] }>(
    `${ML_SITE_SEARCH_PATH}?q=${encodeURIComponent(keyword)}&limit=${RESULTS_PER_KEYWORD}`,
    accessToken
  );
}

/**
 * Coleta REAL mínima de anúncios via busca do site do Mercado Livre.
 * A busca sem token passou a responder HTTP 403, então a coleta usa o
 * caminho OAuth já autorizado (getValidMercadoLivreToken/mercadoLivreGet,
 * o mesmo do coletor de tendências). Salva anúncios em marketplace_trends
 * e registra a execução em marketplace_trend_runs.
 *
 * PENDENTE (requer OAuth do ML): catálogo do vendedor, preço/estoque em
 * tempo real dos produtos cadastrados e publicação.
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
        const data = await fetchAuthenticatedSearch(keyword, accessToken);
        const rows = mapPublicSearchResults(data, keyword, runType, capturedAt);
        fetched += rows.length;
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
    source: "mercado_livre_site_search",
    kind: "authenticated_listings_oauth",
    keywords,
    fetched,
    stored,
    errors
  };
}
