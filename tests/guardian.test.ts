import { describe, expect, it } from "vitest";
import { runGuardian } from "../lib/guardian";

const base:any = {
  id:"p1",title:"Produto seguro para teste",platform:"mercado_livre",
  cost:50,marketPrice:100,stock:10,score:90,status:"APROVADO",
  supplierId:"s1",updatedAt:new Date().toISOString(),
  sourceUrl:"https://example.com/item",
  supplierStatus:"HOMOLOGADO",supplierDispatchHours:24,
  hasInvoice:true,invoiceMode:"FORNECEDOR_EMITE",hasTracking:true,
  shipsDirectly:true,policyRisk:10,restrictedCategory:false
};

describe("Guardião RL - publicação",()=>{
  it("aprova somente cadeia operacional comprovada",()=>{
    expect(runGuardian(base).approved).toBe(true);
  });
  it("bloqueia fornecedor em teste",()=>{
    expect(runGuardian({...base,supplierStatus:"EM_TESTE"}).approved).toBe(false);
  });
  it("bloqueia produto sem fornecedor",()=>{
    expect(runGuardian({...base,supplierStatus:undefined,supplierDispatchHours:undefined,hasInvoice:undefined,invoiceMode:undefined,hasTracking:undefined,shipsDirectly:undefined}).approved).toBe(false);
  });
  it("bloqueia NF ainda a validar",()=>{
    expect(runGuardian({...base,invoiceMode:"A_VALIDAR"}).approved).toBe(false);
  });
  it("bloqueia envio direto ou rastreio não confirmados",()=>{
    expect(runGuardian({...base,shipsDirectly:false}).approved).toBe(false);
    expect(runGuardian({...base,hasTracking:false}).approved).toBe(false);
  });
});
