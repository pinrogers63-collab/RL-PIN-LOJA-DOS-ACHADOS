import { describe, expect, it } from "vitest";
import { buildSalonBrief } from "../lib/salon-brief";

describe("Salon brief", () => {
  it("gera 4 conceitos e copy", () => {
    const r = buildSalonBrief({
      title:"Luminária touch",
      category:"decoração",
      platform:"shopee",
      marketPrice:79.9
    });
    expect(r.concepts).toHaveLength(4);
    expect(r.copy.headline).toContain("Luminária touch");
    expect(r.fidelityRule.length).toBeGreaterThan(20);
  });
});
