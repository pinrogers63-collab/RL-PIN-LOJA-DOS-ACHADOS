import type { Product } from "./types";

export type GuardianInput = Product & {
  brand?: string;
  category?: string;
  supplierStatus?: "EM_TESTE" | "HOMOLOGADO" | "BLOQUEADO";
  supplierDispatchHours?: number;
  hasInvoice?: boolean;
  hasTracking?: boolean;
  policyRisk?: number;
  restrictedCategory?: boolean;
};

export type GuardianCheck = {
  key: string;
  label: string;
  ok: boolean;
  blocking: boolean;
  detail: string;
};

export type GuardianResult = {
  approved: boolean;
  score: number;
  blockers: string[];
  checks: GuardianCheck[];
};

export function runGuardian(product: GuardianInput): GuardianResult {
  const checks: GuardianCheck[] = [
    {
      key: "margin",
      label: "Preço acima do custo",
      ok: product.marketPrice > product.cost,
      blocking: true,
      detail: product.marketPrice > product.cost ? "Estrutura básica de margem válida." : "Preço de mercado não cobre o custo."
    },
    {
      key: "stock",
      label: "Estoque disponível",
      ok: (product.stock ?? 0) > 0,
      blocking: true,
      detail: (product.stock ?? 0) > 0 ? "Há estoque informado." : "Produto sem estoque."
    },
    {
      key: "identity",
      label: "Identificação de origem",
      ok: Boolean(product.sourceUrl || product.externalId || product.sku),
      blocking: false,
      detail: product.sourceUrl || product.externalId || product.sku ? "Origem identificável." : "Falta URL, ID externo ou SKU."
    },
    {
      key: "title",
      label: "Título mínimo",
      ok: product.title.trim().length >= 8,
      blocking: false,
      detail: product.title.trim().length >= 8 ? "Título suficiente para análise." : "Título muito curto."
    },
    {
      key: "restricted",
      label: "Categoria permitida",
      ok: !product.restrictedCategory,
      blocking: true,
      detail: product.restrictedCategory ? "Categoria marcada como restrita." : "Sem bloqueio de categoria informado."
    },
    {
      key: "supplier",
      label: "Fornecedor apto",
      ok: product.supplierStatus !== "BLOQUEADO",
      blocking: true,
      detail: product.supplierStatus === "BLOQUEADO" ? "Fornecedor bloqueado." : product.supplierStatus === "HOMOLOGADO" ? "Fornecedor homologado." : "Fornecedor ainda em teste."
    },
    {
      key: "dispatch",
      label: "Prazo de despacho",
      ok: product.supplierDispatchHours == null || product.supplierDispatchHours <= 48,
      blocking: false,
      detail: product.supplierDispatchHours == null ? "Prazo ainda não informado." : product.supplierDispatchHours <= 48 ? "Prazo dentro da faixa operacional inicial." : "Prazo de despacho alto."
    },
    {
      key: "tracking",
      label: "Rastreio",
      ok: product.hasTracking !== false,
      blocking: false,
      detail: product.hasTracking === false ? "Fornecedor sem rastreio confirmado." : "Rastreio disponível ou pendente de validação."
    },
    {
      key: "invoice",
      label: "Nota fiscal",
      ok: product.hasInvoice !== false,
      blocking: false,
      detail: product.hasInvoice === false ? "Nota fiscal não confirmada." : "Nota fiscal disponível ou pendente de validação."
    },
    {
      key: "policy",
      label: "Risco de política",
      ok: (product.policyRisk ?? 0) < 60,
      blocking: true,
      detail: (product.policyRisk ?? 0) < 60 ? "Risco de política aceitável para análise." : "Risco de política elevado."
    }
  ];

  const blockers = checks.filter(c => c.blocking && !c.ok).map(c => c.label);
  const score = Math.round((checks.filter(c => c.ok).length / checks.length) * 100);

  return {
    approved: blockers.length === 0 && score >= 75,
    score,
    blockers,
    checks
  };
}
