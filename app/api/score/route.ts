import { scoreOpportunity } from "@/lib/scoring";

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json({
    ok: true,
    result: scoreOpportunity({
      marginPercentage: Number(body.marginPercentage ?? 0),
      stock: Number(body.stock ?? 0),
      salesMomentum: Number(body.salesMomentum ?? 50),
      competition: Number(body.competition ?? 50),
      supplierReliability: Number(body.supplierReliability ?? 50),
      policyRisk: Number(body.policyRisk ?? 20)
    })
  });
}
