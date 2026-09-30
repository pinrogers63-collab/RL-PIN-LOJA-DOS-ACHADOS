import { describe, expect, it } from "vitest";
import { runGuardian } from "../lib/guardian";

const product:any = {
  id:"1",
  title:"Produto de teste completo",
  platform:"shopee",
  sourceUrl:"https://example.com/p/1",
  cost:40,
  marketPrice:90,
  stock:10,
  score:80,
  status:"APROVADO",
  updatedAt:new Date().toISOString()
};

describe("Guardian RL", () => {
  it("aprova produto sem bloqueadores", () => {
    const r = runGuardian({
      ...product,
      supplierStatus:"HOMOLOGADO",
      supplierDispatchHours:24,
      hasInvoice:true,
      hasTracking:true,
      policyRisk:10,
      restrictedCategory:false
    });
    expect(r.approved).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it("bloqueia categoria restrita", () => {
    const r = runGuardian({...product,restrictedCategory:true});
    expect(r.approved).toBe(false);
    expect(r.blockers).toContain("Categoria permitida");
  });
});
