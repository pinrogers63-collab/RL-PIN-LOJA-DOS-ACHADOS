import type { MarketplaceFees, ProfitResult } from "./types";

function round(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateProfit(
  productCost: number,
  salePrice: number,
  fees: MarketplaceFees
): ProfitResult {
  const marketplaceFees = salePrice * (fees.percentageFee / 100) + (fees.fixedFee ?? 0);
  const shipping = fees.estimatedShipping ?? 0;
  const reserve = salePrice * ((fees.reservePercentage ?? 0) / 100);
  const ads = salePrice * ((fees.estimatedAdsPercentage ?? 0) / 100);

  const totalCost = productCost + marketplaceFees + shipping + reserve + ads;
  const profit = salePrice - totalCost;
  const marginPercentage = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  const variablePercent =
    (fees.percentageFee +
      (fees.reservePercentage ?? 0) +
      (fees.estimatedAdsPercentage ?? 0)) /
    100;

  const fixedCosts = productCost + (fees.fixedFee ?? 0) + shipping;
  const minimumPrice =
    variablePercent < 1 ? fixedCosts / Math.max(0.01, 1 - variablePercent) : 0;

  const targetMargin = 0.3;
  const suggestedPrice =
    variablePercent + targetMargin < 1
      ? fixedCosts / Math.max(0.01, 1 - variablePercent - targetMargin)
      : minimumPrice;

  let verdict: ProfitResult["verdict"] = "DESCARTAR";
  if (marginPercentage >= 35) verdict = "EXCELENTE";
  else if (marginPercentage >= 25) verdict = "VIAVEL";
  else if (marginPercentage >= 15) verdict = "APERTADO";
  else if (marginPercentage >= 5) verdict = "AGUARDAR";

  return {
    grossRevenue: round(salePrice),
    marketplaceFees: round(marketplaceFees),
    shipping: round(shipping),
    reserve: round(reserve),
    ads: round(ads),
    productCost: round(productCost),
    totalCost: round(totalCost),
    profit: round(profit),
    marginPercentage: round(marginPercentage),
    minimumPrice: round(minimumPrice),
    suggestedPrice: round(suggestedPrice),
    verdict
  };
}
