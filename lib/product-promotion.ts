import { getSupabaseServiceRole } from "./supabase-server";
import { productFingerprint, scoreOpportunity } from "./scoring";
import type { PlatformId, ProductStatus } from "./types";

/**
 * PONTE AUTOMÁTICA coleta → produtos (garimpo).
 *
 * Os coletores (Mercado Livre público, Shopee da loja, Amazon — quando
 * ativa) gravam anúncios em `marketplace_trends` (kind = "listing").
 * Antes desta ponte, NADA promovia essas linhas para `products` — a
 * única inserção era o formulário manual do painel — e por isso o
 * GET /api/opportunities/export retornava count:0 para sempre.
 *
 * Este módulo fecha a ligação: lê as listagens armazenadas mais
 * recentes, deduplica por (platform, listing_id), calcula um score
 * inicial determinístico e faz upsert em `products`:
 *  - anúncio novo  → INSERT com status NOVO/OBSERVAR;
 *  - anúncio já na esteira → UPDATE de preço/link/título apenas
 *    (score/status só são recalculados enquanto o humano não assumiu
 *    o produto: status NOVO/OBSERVAR; APROVADO, EM_ALTA, SALAO,
 *    PUBLICADO e DESCARTADO nunca são sobrescritos nem ressuscitados).
 *
 * O passo roda no fim dos crons de coleta (09:00) e atualização (15:00)
 * e processa o estoque armazenado — não apenas o lote da execução —
 * para que listagens de execuções anteriores também virem produtos.
 */

export type StoredListingRow = {
  platform: string | null;
  url: string | null;
  title: string | null;
  price: number | string | null;
  listing_id: string | null;
  kind: string | null;
  captured_at: string | null;
};

export type PromotedProductInsert = {
  platform: string;
  external_id: string;
  sku: null;
  source_url: string | null;
  title: string;
  cost: number;
  market_price: number;
  stock: number;
  score: number;
  status: ProductStatus;
  supplier_id: null;
  fingerprint: string;
};

export type DedupedListing = {
  row: StoredListingRow;
  occurrences: number;
};

const FETCH_LIMIT = 1000;
export const PROMOTION_BATCH_LIMIT = 500;

/**
 * Score inicial de um anúncio promovido automaticamente.
 *
 * O anúncio público só traz título/preço/link — custo, estoque e
 * fornecedor são DESCONHECIDOS. A heurística é determinística e usa
 * scoreOpportunity com os sinais documentados abaixo (nada inventado
 * além de placeholders explícitos):
 *  - marginPercentage = 30: placeholder igual à meta de margem padrão
 *    do sistema (app_settings.target_margin_percentage). O custo real
 *    é desconhecido; usar a meta NÃO afirma margem nenhuma — só evita
 *    zerar o componente enquanto o custo não é pesquisado.
 *  - stock = 0: desconhecido → nenhum ponto de estoque.
 *  - salesMomentum = 40 + 10 × (ocorrências − 1), teto 100: a
 *    recorrência do mesmo anúncio nas capturas armazenadas (várias
 *    palavras-chave/execuções) é o único sinal de demanda observável.
 *  - competition/supplierReliability/policyRisk: defaults do próprio
 *    scoreOpportunity (50/50/20).
 */
export function initialListingScore(occurrences: number) {
  const salesMomentum = Math.min(100, 40 + 10 * Math.max(0, occurrences - 1));
  return scoreOpportunity({
    marginPercentage: 30,
    stock: 0,
    salesMomentum,
    competition: 50,
    supplierReliability: 50,
    policyRisk: 20
  });
}

/**
 * Status de entrada de um produto promovido: NOVO ou OBSERVAR
 * (limiar OBSERVAR do scoreOpportunity, score ≥ 58). Promoção
 * automática NUNCA entra como EM_ALTA/APROVADO — esses estados são
 * decisão humana ou de enriquecimento posterior.
 */
export function promotedStatus(score: number): ProductStatus {
  return score >= 58 ? "OBSERVAR" : "NOVO";
}

function listingKey(row: StoredListingRow) {
  return `${row.platform ?? ""}|${row.listing_id ?? ""}`;
}

function isPromotable(row: StoredListingRow): boolean {
  return (
    row.kind === "listing" &&
    typeof row.listing_id === "string" &&
    row.listing_id.trim().length > 0 &&
    typeof row.title === "string" &&
    row.title.trim().length > 0 &&
    typeof row.platform === "string" &&
    row.platform.trim().length > 0
  );
}

/**
 * Deduplica listagens armazenadas por (platform, listing_id),
 * mantendo a captura mais recente de cada anúncio e contando as
 * ocorrências (sinal de momentum). Função pura — testável sem banco.
 * Espera as linhas ordenadas por captured_at DESC (a primeira
 * ocorrência de cada chave é a mais recente).
 */
export function dedupeStoredListings(rows: StoredListingRow[]): DedupedListing[] {
  const byKey = new Map<string, DedupedListing>();
  for (const row of rows ?? []) {
    if (!row || !isPromotable(row)) continue;
    const key = listingKey(row);
    const existing = byKey.get(key);
    if (existing) {
      existing.occurrences += 1;
    } else {
      byKey.set(key, { row, occurrences: 1 });
    }
  }
  return [...byKey.values()];
}

function toPrice(value: number | string | null): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Mapeia uma listagem deduplicada para a linha de INSERT em products. */
export function mapStoredListingToProduct(listing: DedupedListing): PromotedProductInsert {
  const { row, occurrences } = listing;
  const title = row.title!.trim().slice(0, 300);
  const platform = row.platform!;
  const externalId = row.listing_id!;
  const sourceUrl = typeof row.url === "string" && row.url.trim().length > 0 ? row.url : null;
  const { score } = initialListingScore(occurrences);
  return {
    platform,
    external_id: externalId,
    sku: null,
    source_url: sourceUrl,
    title,
    // Custo e estoque reais são desconhecidos no anúncio público.
    cost: 0,
    market_price: toPrice(row.price),
    stock: 0,
    score,
    status: promotedStatus(score),
    supplier_id: null,
    fingerprint: productFingerprint({
      platform: platform as PlatformId,
      externalId,
      sku: undefined,
      sourceUrl: sourceUrl ?? undefined,
      title
    })
  };
}

/** Status que a promoção pode recalcular (o humano ainda não assumiu). */
const PROMOTION_MANAGED_STATUSES: ReadonlySet<string> = new Set(["NOVO", "OBSERVAR"]);

type ExistingProductRow = {
  id: string;
  platform: string;
  external_id: string | null;
  status: string;
};

export type PromotionResult = {
  ok: boolean;
  examined: number;
  candidates: number;
  inserted: number;
  updated: number;
  skipped: number;
  error?: string;
};

/**
 * Executa a promoção: lê as listagens armazenadas mais recentes de
 * marketplace_trends e faz upsert em products. Nunca lança — falha
 * vira { ok: false, error } para não derrubar o cron chamador.
 */
export async function promoteStoredListings(
  options: { batchLimit?: number; supabase?: any } = {}
): Promise<PromotionResult> {
  const batchLimit = options.batchLimit ?? PROMOTION_BATCH_LIMIT;
  const base: PromotionResult = {
    ok: true,
    examined: 0,
    candidates: 0,
    inserted: 0,
    updated: 0,
    skipped: 0
  };

  try {
    const supabase = options.supabase ?? getSupabaseServiceRole();

    const { data: trendRows, error: trendsError } = await supabase
      .from("marketplace_trends")
      .select("platform, url, title, price, listing_id, kind, captured_at")
      .eq("kind", "listing")
      .order("captured_at", { ascending: false })
      .limit(FETCH_LIMIT);
    if (trendsError) throw new Error(`Falha ao ler listagens: ${trendsError.message}`);

    const rows = (trendRows ?? []) as StoredListingRow[];
    base.examined = rows.length;

    const candidates = dedupeStoredListings(rows)
      .slice(0, batchLimit)
      .map(mapStoredListingToProduct);
    base.candidates = candidates.length;
    if (candidates.length === 0) return base;

    // Estado atual da esteira para os mesmos (platform, external_id).
    const platforms = [...new Set(candidates.map((c) => c.platform))];
    const externalIds = [...new Set(candidates.map((c) => c.external_id))];
    const { data: existingRows, error: existingError } = await supabase
      .from("products")
      .select("id, platform, external_id, status")
      .in("platform", platforms)
      .in("external_id", externalIds);
    if (existingError) throw new Error(`Falha ao ler produtos: ${existingError.message}`);

    const existingByKey = new Map<string, ExistingProductRow>();
    for (const row of (existingRows ?? []) as ExistingProductRow[]) {
      if (row.external_id) existingByKey.set(`${row.platform}|${row.external_id}`, row);
    }

    const inserts: PromotedProductInsert[] = [];
    const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];

    for (const candidate of candidates) {
      const existing = existingByKey.get(`${candidate.platform}|${candidate.external_id}`);
      if (!existing) {
        inserts.push(candidate);
        continue;
      }
      if (existing.status === "DESCARTADO") {
        // Descarte humano é definitivo: não ressuscita nem atualiza.
        base.skipped += 1;
        continue;
      }
      const patch: Record<string, unknown> = {
        title: candidate.title,
        source_url: candidate.source_url,
        market_price: candidate.market_price,
        fingerprint: candidate.fingerprint,
        updated_at: new Date().toISOString()
      };
      if (PROMOTION_MANAGED_STATUSES.has(existing.status)) {
        patch.score = candidate.score;
        patch.status = candidate.status;
      }
      updates.push({ id: existing.id, patch });
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("products").insert(inserts);
      if (insertError) throw new Error(`Falha ao promover produtos: ${insertError.message}`);
      base.inserted = inserts.length;
    }

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from("products")
        .update(update.patch)
        .eq("id", update.id);
      if (updateError) throw new Error(`Falha ao atualizar produto promovido: ${updateError.message}`);
      base.updated += 1;
    }

    return base;
  } catch (error) {
    return {
      ...base,
      ok: false,
      error: error instanceof Error ? error.message : "Erro inesperado na promoção."
    };
  }
}
