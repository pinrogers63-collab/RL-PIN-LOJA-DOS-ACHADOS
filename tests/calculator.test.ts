import { describe, expect, it } from "vitest";
import { calculateProfit } from "../lib/calculator";

describe("calculateProfit", () => {
  it("calcula lucro e margem", () => {
    const r = calculateProfit(40, 100, {
      percentageFee: 10,
      fixedFee: 2,
      estimatedShipping: 8,
      reservePercentage: 5,
      estimatedAdsPercentage: 5
    });
    expect(r.profit).toBe(30);
    expect(r.marginPercentage).toBe(30);
    expect(r.verdict).toBe("VIAVEL");
  });

  it("não quebra com preço zero", () => {
    const r = calculateProfit(20, 0, { percentageFee: 10 });
    expect(r.marginPercentage).toBe(0);
    expect(r.verdict).toBe("DESCARTAR");
  });
});
