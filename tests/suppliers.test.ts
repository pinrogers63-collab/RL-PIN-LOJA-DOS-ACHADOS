import { describe, expect, it } from "vitest";
import { canHomologate, supplierScore } from "../lib/suppliers";

describe("supplier", () => {
  const s:any = {
    id:"1",name:"Fornecedor",
    status:"EM_TESTE",
    channels:["shopee"],
    shipsDirectly:true,
    invoice:true,
    invoiceMode:"FORNECEDOR_EMITE",
    tracking:true,
    dispatchHours:24,
    stockSync:true,
    testedOrders:3,
    passedTests:3,
    failedTests:0
  };

  it("calcula score alto para fornecedor completo", () => {
    expect(supplierScore(s)).toBeGreaterThanOrEqual(80);
  });

  it("bloqueia homologação sem NF verificada", () => {
    expect(canHomologate({...s, invoiceMode:"A_VALIDAR"})).toBe(false);
  });

  it("reprovação bloqueia homologação", () => {
    expect(canHomologate({...s, failedTests:1})).toBe(false);
  });

  it("não confunde tentativas com testes aprovados", () => {
    expect(canHomologate({...s, testedOrders:3, passedTests:1})).toBe(false);
  });

  it("permite homologação após testes", () => {
    expect(canHomologate(s)).toBe(true);
  });
});
