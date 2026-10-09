import { calculateProfit } from "./calculator";
import { scoreOpportunity, type OpportunitySignals } from "./scoring";
import type { MarketplaceFees } from "./types";

export type PrePublishAnalysisInput = {
  productCost: number;
  salePrice: number;
  fees: MarketplaceFees;
  signals: Omit<OpportunitySignals, "marginPercentage">;
};

export function analyzeBeforePublishing(input: PrePublishAnalysisInput) {
  const financial = calculateProfit(input.productCost, input.salePrice, input.fees);
  const opportunity = scoreOpportunity({
    ...input.signals,
    marginPercentage: financial.marginPercentage
  });

  const blockers: string[] = [];
  if (financial.profit <= 0) blockers.push("Lucro líquido não positivo.");
  if (financial.marginPercentage < 15) blockers.push("Margem abaixo do mínimo operacional.");
  if (input.signals.stock <= 0) blockers.push("Produto sem estoque.");
  if ((input.signals.policyRisk ?? 20) >= 60) blockers.push("Risco de política elevado.");
  if ((input.signals.supplierReliability ?? 50) < 40) blockers.push("Fornecedor com confiabilidade insuficiente.");

  const decision = blockers.length
    ? "NAO_PUBLICAR"
    : opportunity.score >= 72 && financial.marginPercentage >= 25
      ? "PUBLICAR"
      : "REVISAR";

  return {
    decision,
    score: opportunity.score,
    label: opportunity.label,
    reasons: opportunity.reasons,
    blockers,
    financial,
    indicators: {
      stock: input.signals.stock,
      salesMomentum: input.signals.salesMomentum ?? 50,
      competition: input.signals.competition ?? 50,
      supplierReliability: input.signals.supplierReliability ?? 50,
      policyRisk: input.signals.policyRisk ?? 20
    }
  };
}
