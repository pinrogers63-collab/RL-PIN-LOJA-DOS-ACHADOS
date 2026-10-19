/**
 * Estágio 1 do Pipeline do Afiliado (GARIMPO → COPY/VSL → TRACK).
 *
 * Mapeia produtos do RL PIN para o formato aceito pelo
 * `POST /offers/import-batch` do NOVYXPRIME.
 *
 * Regra de honestidade: campos que não existem no RL PIN (dados de
 * afiliado: comissão, tracking link, landing page) saem como `null` —
 * nunca inventados. O `source_url` é o anúncio original e vai para
 * `evidenceUrl`.
 */

export type ProductExportRow = {
  title: string | null;
  market_price: number | string | null;
  source_url: string | null;
  external_id: string | null;
  platform: string | null;
  score: number | string | null;
  status: string | null;
};

export type ExportedOpportunity = {
  name: string | null;
  price: number | null;
  currencyCode: string | null;
  commissionPercent: number | null;
  commissionAmount: number | null;
  affiliateLink: string | null;
  landingPageUrl: string | null;
  evidenceUrl: string | null;
  externalOfferId: string | null;
  category: string | null;
};

export const EXPORT_FIELD_ORDER: (keyof ExportedOpportunity)[] = [
  "name",
  "price",
  "currencyCode",
  "commissionPercent",
  "commissionAmount",
  "affiliateLink",
  "landingPageUrl",
  "evidenceUrl",
  "externalOfferId",
  "category",
];

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export function mapProductToExport(row: ProductExportRow): ExportedOpportunity {
  return {
    name: toText(row.title),
    price: toNumber(row.market_price),
    // RL PIN opera em BRL por padrão (app_settings.default_currency).
    currencyCode: "BRL",
    // Sem dados de afiliado no RL PIN: nunca inventar comissão.
    commissionPercent: null,
    commissionAmount: null,
    affiliateLink: null,
    landingPageUrl: null,
    // Link do anúncio original (evidência do garimpo).
    evidenceUrl: toText(row.source_url),
    externalOfferId: toText(row.external_id),
    // RL PIN não tem categoria de produto; platform é o marketplace.
    category: null,
  };
}

/** Status considerados "ativos" para exportação (tudo exceto descartados). */
export const INACTIVE_PRODUCT_STATUSES = ["DESCARTADO"] as const;
