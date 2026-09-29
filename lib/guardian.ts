import type { Product } from "./types";

export type GuardianResult = {
  approved: boolean;
  score: number;
  checks: { key: string; ok: boolean; message: string }[];
};

export function runGuardian(product: Product): GuardianResult {
  const checks = [
    {
      key: "preco",
      ok: product.marketPrice > product.cost,
      message: product.marketPrice > product.cost
        ? "Preço de mercado acima do custo."
        : "Preço de mercado não cobre o custo do produto."
    },
    {
      key: "estoque",
      ok: (product.stock ?? 1) > 0,
      message: (product.stock ?? 1) > 0
        ? "Estoque informado disponível."
        : "Sem estoque informado."
    },
    {
      key: "origem",
      ok: Boolean(product.sourceUrl || product.externalId),
      message: Boolean(product.sourceUrl || product.externalId)
        ? "Origem rastreável."
        : "Falta link ou ID de origem."
    },
    {
      key: "identificacao",
      ok: product.title.trim().length >= 8,
      message: product.title.trim().length >= 8
        ? "Produto identificado."
        : "Título insuficiente para validação."
    }
  ];

  const score = Math.round(
    (checks.filter((check) => check.ok).length / checks.length) * 100
  );

  return {
    approved: score >= 75,
    score,
    checks
  };
}
