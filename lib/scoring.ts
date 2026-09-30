import type { Product } from "./types";

export type OpportunitySignals = {
  marginPercentage: number;
  stock: number;
  salesMomentum?: number;
  competition?: number;
  supplierReliability?: number;
  policyRisk?: number;
};

export type OpportunityScore = {
  score: number;
  label: "ACELERANDO" | "BOM_MOMENTO" | "OBSERVAR" | "AGUARDAR" | "DESCARTAR";
  reasons: string[];
};

export function scoreOpportunity(signals: OpportunitySignals): OpportunityScore {
  const reasons: string[] = [];
  const margin = Math.max(0, Math.min(100, signals.marginPercentage * 2));
  const stock = signals.stock > 20 ? 100 : signals.stock > 5 ? 65 : signals.stock > 0 ? 35 : 0;
  const momentum = Math.max(0, Math.min(100, signals.salesMomentum ?? 50));
  const competition = 100 - Math.max(0, Math.min(100, signals.competition ?? 50));
  const supplier = Math.max(0, Math.min(100, signals.supplierReliability ?? 50));
  const safety = 100 - Math.max(0, Math.min(100, signals.policyRisk ?? 20));

  const score = Math.round(
    margin * 0.28 +
    stock * 0.12 +
    momentum * 0.22 +
    competition * 0.12 +
    supplier * 0.16 +
    safety * 0.10
  );

  if (signals.marginPercentage >= 30) reasons.push("Margem forte.");
  if (signals.stock > 20) reasons.push("Estoque saudável.");
  if ((signals.salesMomentum ?? 50) >= 70) reasons.push("Aceleração de demanda.");
  if ((signals.competition ?? 50) <= 35) reasons.push("Concorrência relativamente favorável.");
  if ((signals.supplierReliability ?? 50) >= 75) reasons.push("Fornecedor confiável.");
  if ((signals.policyRisk ?? 20) >= 60) reasons.push("Risco de política elevado.");

  const label =
    score >= 85 ? "ACELERANDO" :
    score >= 72 ? "BOM_MOMENTO" :
    score >= 58 ? "OBSERVAR" :
    score >= 42 ? "AGUARDAR" : "DESCARTAR";

  return { score, label, reasons };
}

export function productFingerprint(product: Pick<Product, "platform" | "externalId" | "sku" | "sourceUrl" | "title">) {
  const key = [
    product.platform,
    product.externalId ?? "",
    product.sku ?? "",
    product.sourceUrl ?? "",
    product.title.trim().toLowerCase()
  ].join("|");
  return key;
}
