import { calculateProfit } from "@/lib/calculator";

export async function POST(request: Request) {
  const body = await request.json();

  const productCost = Number(body.productCost);
  const salePrice = Number(body.salePrice);

  if (!Number.isFinite(productCost) || !Number.isFinite(salePrice)) {
    return Response.json(
      { ok: false, error: "productCost e salePrice são obrigatórios." },
      { status: 400 }
    );
  }

  const result = calculateProfit(productCost, salePrice, {
    percentageFee: Number(body.percentageFee ?? 0),
    fixedFee: Number(body.fixedFee ?? 0),
    estimatedShipping: Number(body.estimatedShipping ?? 0),
    reservePercentage: Number(body.reservePercentage ?? 0),
    estimatedAdsPercentage: Number(body.estimatedAdsPercentage ?? 0)
  });

  return Response.json({ ok: true, result });
}
