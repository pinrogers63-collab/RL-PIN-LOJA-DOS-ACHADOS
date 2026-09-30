import { describe, expect, it } from "vitest";
import { canHomologate, supplierScore } from "../lib/suppliers";

describe("supplier", () => {
  const s:any = {
    id:"1",name:"Fornecedor",
    status:"EM_TESTE",
    channels:["shopee"],
    shipsDirectly:true,
    invoice:true,
    tracking:true,
    dispatchHours:24,
    stockSync:true,
    testedOrders:3
  };

  it("calcula score alto para fornecedor completo", () => {
    expect(supplierScore(s)).toBeGreaterThanOrEqual(80);
  });

  it("permite homologação após testes", () => {
    expect(canHomologate(s)).toBe(true);
  });
});
