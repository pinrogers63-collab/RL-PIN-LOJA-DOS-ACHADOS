import { describe, expect, it } from "vitest";
import { parseTrendKeywords, mapPublicSearchResults } from "../lib/ml-public-collect";

describe("parseTrendKeywords", () => {
  it("usa padrões quando a variável está ausente ou vazia", () => {
    expect(parseTrendKeywords(undefined)).toEqual(["ofertas do dia", "mais vendidos", "eletrônicos"]);
    expect(parseTrendKeywords("")).toEqual(["ofertas do dia", "mais vendidos", "eletrônicos"]);
    expect(parseTrendKeywords("   ")).toEqual(["ofertas do dia", "mais vendidos", "eletrônicos"]);
  });

  it("separa por vírgula e remove espaços", () => {
    expect(parseTrendKeywords(" perfume , bolsa vintage ")).toEqual(["perfume", "bolsa vintage"]);
  });

  it("descarta termos muito curtos e limita a 8 palavras-chave", () => {
    const many = Array.from({ length: 12 }, (_, i) => `termo${i}`).join(",");
    const parsed = parseTrendKeywords(`a,${many}`);
    expect(parsed).toHaveLength(8);
    expect(parsed).not.toContain("a");
  });
});

describe("mapPublicSearchResults", () => {
  const capturedAt = new Date().toISOString();

  it("normaliza anúncios válidos em linhas da tabela", () => {
    const rows = mapPublicSearchResults(
      {
        results: [
          { id: "MLB123", title: "Perfume Importado", price: 199.9, permalink: "https://produto.mercadolivre.com.br/MLB123" },
          { id: "MLB124", title: "Bolsa Couro", price: 89.9, permalink: "https://produto.mercadolivre.com.br/MLB124" }
        ]
      },
      "perfume",
      "COLLECT",
      capturedAt
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      platform: "mercado_livre",
      keyword: "perfume",
      listing_id: "MLB123",
      title: "Perfume Importado",
      price: 199.9,
      kind: "listing",
      run_type: "COLLECT",
      captured_at: capturedAt
    });
  });

  it("filtra resultados inválidos e tolera payload inesperado", () => {
    const rows = mapPublicSearchResults(
      { results: [{ id: "MLB1" }, { title: "Sem ID" }, null, { id: "MLB2", title: "Ok", price: NaN }] as any },
      "bolsa",
      "COLLECT",
      capturedAt
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].listing_id).toBe("MLB2");
    expect(rows[0].price).toBeNull();
  });

  it("retorna vazio quando não há resultados", () => {
    expect(mapPublicSearchResults(null, "x", "COLLECT", capturedAt)).toEqual([]);
    expect(mapPublicSearchResults({}, "x", "COLLECT", capturedAt)).toEqual([]);
  });

  it("limita o título a 300 caracteres", () => {
    const rows = mapPublicSearchResults(
      { results: [{ id: "MLB9", title: "A".repeat(500), price: 10 }] },
      "x",
      "COLLECT",
      capturedAt
    );
    expect(rows[0].title!.length).toBe(300);
  });
});
