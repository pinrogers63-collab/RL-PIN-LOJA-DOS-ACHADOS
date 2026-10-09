import { analyzeBeforePublishing } from "@/lib/prepublish-analysis";

export async function POST(request: Request) {
  const body = await request.json();
  const productCost = Number(body.productCost);
  const salePrice = Number(body.salePrice);

  if (!Number.isFinite(productCost) || !Number.isFinite(salePrice)) {
    return Response.json({ ok: false, error: "Custo e preço de venda são obrigatórios." }, { status: 400 });
  }

  const result = analyzeBeforePublishing({
    productCost,
    salePrice,
    fees: {
      percentageFee: Number(body.percentageFee ?? 0),
      fixedFee: Number(body.fixedFee ?? 0),
      estimatedShipping: Number(body.estimatedShipping ?? 0),
      reservePercentage: Number(body.reservePercentage ?? 0),
      estimatedAdsPercentage: Number(body.estimatedAdsPercentage ?? 0)
    },
    signals: {
      stock: Number(body.stock ?? 0),
      salesMomentum: Number(body.salesMomentum ?? 50),
      competition: Number(body.competition ?? 50),
      supplierReliability: Number(body.supplierReliability ?? 50),
      policyRisk: Number(body.policyRisk ?? 20)
    }
  });

  return Response.json({ ok: true, result });
}
