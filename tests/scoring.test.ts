import { describe, expect, it } from "vitest";
import { productFingerprint, scoreOpportunity } from "../lib/scoring";

describe("scoreOpportunity", () => {
  it("premia sinais fortes", () => {
    const r = scoreOpportunity({
      marginPercentage: 40,
      stock: 50,
      salesMomentum: 90,
      competition: 20,
      supplierReliability: 90,
      policyRisk: 10
    });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(["ACELERANDO","BOM_MOMENTO"]).toContain(r.label);
  });

  it("fingerprint é estável para o mesmo produto", () => {
    const base:any = {
      platform:"shopee",
      externalId:"abc",
      sku:"sku1",
      sourceUrl:"https://x",
      title:"Produto Teste"
    };
    expect(productFingerprint(base)).toBe(productFingerprint({...base,title:"  PRODUTO TESTE  "}));
  });
});
