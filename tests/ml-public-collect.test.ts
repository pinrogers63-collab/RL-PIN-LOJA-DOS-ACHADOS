import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  parseTrendKeywords,
  mapCatalogSearchHits,
  resolveCatalogPrice,
  mapCatalogProductToTrendRow,
  mapCatalogItemOffers,
  firstPricedCatalogOffer,
  applyCatalogOffer,
  formatDiscardSummary,
  collectPublicListings
} from "../lib/ml-public-collect";
import { getValidMercadoLivreToken, mercadoLivreGet } from "@/lib/mercadolivre";
import { getSupabaseServiceRole } from "@/lib/supabase-server";

vi.mock("@/lib/mercadolivre", async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>;
  return { ...actual, getValidMercadoLivreToken: vi.fn(), mercadoLivreGet: vi.fn() };
});

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServiceRole: vi.fn()
}));

const mockedToken = getValidMercadoLivreToken as unknown as ReturnType<typeof vi.fn>;
const mockedMlGet = mercadoLivreGet as unknown as ReturnType<typeof vi.fn>;
const mockedSupabase = getSupabaseServiceRole as unknown as ReturnType<typeof vi.fn>;

const insertCalls: Array<{ table: string; rows: any }> = [];

function fakeSupabase() {
  return {
    from(table: string) {
      return {
        insert: async (rows: any) => {
          insertCalls.push({ table, rows });
          return { error: null };
        }
      };
    }
  };
}

const OLD_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  process.env.ML_TREND_KEYWORDS = "perfume,bolsa";
  mockedSupabase.mockReturnValue(fakeSupabase());
  mockedToken.mockResolvedValue("access-token-123");
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

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

describe("mapCatalogSearchHits", () => {
  it("mantém só produtos com id válido e tolera payload inesperado", () => {
    const hits = mapCatalogSearchHits({
      results: [
        { id: "MLB100", name: "Perfume" },
        { name: "Sem ID" },
        { id: "  " },
        null,
        { id: "MLB200", name: "Bolsa" }
      ] as any
    });
    expect(hits.map((h) => h.id)).toEqual(["MLB100", "MLB200"]);
    expect(mapCatalogSearchHits(null)).toEqual([]);
    expect(mapCatalogSearchHits({})).toEqual([]);
  });
});

describe("resolveCatalogPrice", () => {
  it("prefere o preço do vencedor do buy box", () => {
    expect(
      resolveCatalogPrice({
        buy_box_winner: { price: 199.9 },
        buy_box_winner_price_range: { min_price: 150, max_price: 300 },
        min_price: 140
      })
    ).toBe(199.9);
  });

  it("cai para o piso da faixa do buy box e depois para o piso do produto", () => {
    expect(
      resolveCatalogPrice({ buy_box_winner: null, buy_box_winner_price_range: { min_price: 150, max_price: 300 } })
    ).toBe(150);
    expect(resolveCatalogPrice({ min_price: 42.5 })).toBe(42.5);
  });

  it("ignora preços inválidos e retorna null sem nenhuma fonte válida", () => {
    expect(resolveCatalogPrice({ buy_box_winner: { price: NaN }, min_price: 10 })).toBe(10);
    expect(resolveCatalogPrice({ buy_box_winner: { price: 0 } })).toBeNull();
    expect(resolveCatalogPrice({})).toBeNull();
  });
});

describe("mapCatalogProductToTrendRow", () => {
  const capturedAt = new Date().toISOString();

  it("com buy box: listing_id é o item vencedor e o preço é o dele", () => {
    const row = mapCatalogProductToTrendRow(
      {
        id: "MLB100",
        name: "Perfume Importado 100ml",
        permalink: "https://www.mercadolivre.com.br/p/MLB100",
        buy_box_winner: { item_id: "MLB555", price: 199.9, seller_id: 123 },
        buy_box_winner_price_range: { min_price: 180, max_price: 250 }
      },
      "perfume",
      "COLLECT",
      capturedAt
    );
    expect(row).toMatchObject({
      platform: "mercado_livre",
      keyword: "perfume",
      url: "https://www.mercadolivre.com.br/p/MLB100",
      title: "Perfume Importado 100ml",
      price: 199.9,
      listing_id: "MLB555",
      kind: "listing",
      run_type: "COLLECT",
      captured_at: capturedAt
    });
  });

  it("sem vencedor do buy box: listing_id é o id do catálogo e o preço é o piso da faixa", () => {
    const row = mapCatalogProductToTrendRow(
      {
        id: "MLB200",
        name: "Bolsa de Couro",
        buy_box_winner: null,
        buy_box_winner_price_range: { min_price: 89.9, max_price: 129.9 }
      },
      "bolsa",
      "REFRESH",
      capturedAt
    );
    expect(row).toMatchObject({ listing_id: "MLB200", price: 89.9, url: null, run_type: "REFRESH" });
  });

  it("descarta produto sem preço em nenhuma fonte (a promoção exige preço)", () => {
    expect(mapCatalogProductToTrendRow({ id: "MLB300", name: "Sem Preço" }, "x", "COLLECT", capturedAt)).toBeNull();
    expect(
      mapCatalogProductToTrendRow({ id: "MLB300", name: "Sem Preço", buy_box_winner: {} }, "x", "COLLECT", capturedAt)
    ).toBeNull();
  });

  it("descarta produto sem id ou sem nome e limita o título a 300 caracteres", () => {
    expect(mapCatalogProductToTrendRow({ name: "Ok", min_price: 10 }, "x", "COLLECT", capturedAt)).toBeNull();
    expect(mapCatalogProductToTrendRow({ id: "MLB1", min_price: 10 }, "x", "COLLECT", capturedAt)).toBeNull();
    expect(mapCatalogProductToTrendRow(null, "x", "COLLECT", capturedAt)).toBeNull();
    const row = mapCatalogProductToTrendRow(
      { id: "MLB9", name: "A".repeat(500), min_price: 10 },
      "x",
      "COLLECT",
      capturedAt
    );
    expect(row!.title!.length).toBe(300);
  });
});

describe("mapCatalogItemOffers / firstPricedCatalogOffer", () => {
  it("mantém só ofertas-objeto e tolera payload inesperado", () => {
    const offers = mapCatalogItemOffers({
      results: [{ item_id: "MLB1", price: 10 }, null, "lixo", { item_id: "MLB2" }] as any
    });
    expect(offers).toHaveLength(2);
    expect(mapCatalogItemOffers(null)).toEqual([]);
    expect(mapCatalogItemOffers({})).toEqual([]);
  });

  it("retorna a primeira oferta com preço válido (> 0), pulando as sem preço", () => {
    const offers = [
      { item_id: "MLB1" },
      { item_id: "MLB2", price: 0 },
      { item_id: "MLB3", price: NaN },
      { item_id: "MLB4", price: 77.5 },
      { item_id: "MLB5", price: 10 }
    ];
    expect(firstPricedCatalogOffer(offers)?.item_id).toBe("MLB4");
    expect(firstPricedCatalogOffer([])).toBeNull();
    expect(firstPricedCatalogOffer([{ item_id: "MLB1" }])).toBeNull();
  });
});

describe("applyCatalogOffer", () => {
  it("a oferta vira a fonte primária: preço, item e permalink dela alimentam a linha", () => {
    const product = applyCatalogOffer(
      { id: "MLB100", name: "Perfume", permalink: "https://www.mercadolivre.com.br/p/MLB100", buy_box_winner: null },
      { item_id: "MLB999", price: 129.9, permalink: "https://produto.mercadolivre.com.br/MLB999" }
    );
    expect(resolveCatalogPrice(product)).toBe(129.9);
    const row = mapCatalogProductToTrendRow(product, "perfume", "COLLECT", new Date().toISOString());
    expect(row).toMatchObject({
      price: 129.9,
      listing_id: "MLB999",
      url: "https://produto.mercadolivre.com.br/MLB999"
    });
  });

  it("oferta sem item/permalink próprios: mantém id do catálogo e permalink do produto", () => {
    const product = applyCatalogOffer(
      { id: "MLB100", name: "Perfume", permalink: "https://www.mercadolivre.com.br/p/MLB100" },
      { price: 50 }
    );
    const row = mapCatalogProductToTrendRow(product, "perfume", "COLLECT", new Date().toISOString());
    expect(row).toMatchObject({
      price: 50,
      listing_id: "MLB100",
      url: "https://www.mercadolivre.com.br/p/MLB100"
    });
  });
});

describe("formatDiscardSummary", () => {
  it("formata o resumo contável só com os motivos presentes", () => {
    expect(formatDiscardSummary({ detailFailed: 15, noPrice: 45, offerNoPrice: 0, invalid: 0 })).toBe(
      "descartados: 60 (sem preço: 45, detalhe falhou: 15)"
    );
    expect(formatDiscardSummary({ detailFailed: 0, noPrice: 0, offerNoPrice: 2, invalid: 1 })).toBe(
      "descartados: 3 (oferta sem preço: 2, sem id/nome: 1)"
    );
  });

  it("retorna null quando não houve descarte", () => {
    expect(formatDiscardSummary({ detailFailed: 0, noPrice: 0, offerNoPrice: 0, invalid: 0 })).toBeNull();
  });
});

describe("collectPublicListings (API de Catálogo)", () => {
  function mockCatalog() {
    mockedMlGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/products/search") && path.includes("q=perfume")) {
        return { results: [{ id: "MLB100", name: "Perfume Importado 100ml" }, { id: "MLB101", name: "Perfume Sem Preço" }] };
      }
      if (path.startsWith("/products/search") && path.includes("q=bolsa")) {
        return { results: [{ id: "MLB200", name: "Bolsa de Couro" }] };
      }
      if (path === "/products/MLB100") {
        return {
          id: "MLB100",
          name: "Perfume Importado 100ml",
          permalink: "https://www.mercadolivre.com.br/p/MLB100",
          buy_box_winner: { item_id: "MLB555", price: 199.9, seller_id: 123 }
        };
      }
      if (path === "/products/MLB101") {
        return { id: "MLB101", name: "Perfume Sem Preço", buy_box_winner: null };
      }
      if (path === "/products/MLB101/items") {
        return { results: [] };
      }
      if (path === "/products/MLB200") {
        return {
          id: "MLB200",
          name: "Bolsa de Couro",
          permalink: "https://www.mercadolivre.com.br/p/MLB200",
          buy_box_winner_price_range: { min_price: 89.9, max_price: 129.9 }
        };
      }
      throw new Error(`Caminho inesperado: ${path}`);
    });
  }

  it("busca no catálogo com o token OAuth e grava listagens kind=listing + run SUCCESS", async () => {
    mockCatalog();

    const result = await collectPublicListings("COLLECT");

    expect(mockedToken).toHaveBeenCalledTimes(1);
    expect(mockedMlGet.mock.calls.every((c) => c[1] === "access-token-123")).toBe(true);
    const paths = mockedMlGet.mock.calls.map((c) => String(c[0]));
    expect(paths[0]).toBe("/products/search?site_id=MLB&q=perfume&status=active&limit=20");
    expect(paths).toContain("/products/search?site_id=MLB&q=bolsa&status=active&limit=20");
    expect(paths).toContain("/products/MLB100");
    expect(paths).toContain("/products/MLB200");
    expect(paths.some((p) => p.includes("/sites/MLB/search"))).toBe(false);

    // fetched = produtos retornados pelas buscas (3); stored = só os com preço (2).
    // O descartado (MLB101, sem preço nem no detalhe nem em /items) NÃO é mudo:
    // entra na telemetria, mesmo com o run em SUCCESS.
    expect(result).toMatchObject({
      ok: true,
      kind: "catalog_listings_oauth",
      fetched: 3,
      stored: 2,
      errors: ["descartados: 1 (sem preço: 1)"]
    });
    const trendsInserts = insertCalls.filter((c) => c.table === "marketplace_trends");
    const allRows = trendsInserts.flatMap((c) => c.rows as any[]);
    expect(allRows).toHaveLength(2);
    expect(allRows.map((r) => r.listing_id).sort()).toEqual(["MLB200", "MLB555"]);
    expect(allRows.every((r) => r.platform === "mercado_livre" && r.kind === "listing" && r.run_type === "COLLECT")).toBe(true);
    const perfumeRow = allRows.find((r) => r.listing_id === "MLB555");
    expect(perfumeRow).toMatchObject({ keyword: "perfume", price: 199.9, url: "https://www.mercadolivre.com.br/p/MLB100" });
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts).toHaveLength(1);
    expect(runInserts[0].rows).toMatchObject({
      run_type: "COLLECT",
      status: "SUCCESS",
      fetched: 3,
      stored: 2,
      error: "descartados: 1 (sem preço: 1)"
    });
    expect(paths).toContain("/products/MLB101/items");
  });

  it("sem token válido: não busca, registra run FAILED e não lança", async () => {
    mockedToken.mockRejectedValue(new Error("Mercado Livre ainda não autorizado."));

    const result = await collectPublicListings("REFRESH");

    expect(result.ok).toBe(false);
    expect(result.fetched).toBe(0);
    expect(result.stored).toBe(0);
    expect(result.errors[0]).toMatch(/não autorizado/i);
    expect(mockedMlGet).not.toHaveBeenCalled();
    expect(insertCalls.filter((c) => c.table === "marketplace_trends")).toHaveLength(0);
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts).toHaveLength(1);
    expect(runInserts[0].rows).toMatchObject({ run_type: "REFRESH", status: "FAILED", fetched: 0, stored: 0 });
  });

  it("falha em uma palavra-chave não impede as demais (fail-safe por termo)", async () => {
    mockedMlGet.mockImplementation(async (path: string) => {
      if (path.includes("q=perfume")) throw new Error("Mercado Livre respondeu HTTP 500.");
      if (path.startsWith("/products/search")) return { results: [{ id: "MLB200", name: "Bolsa de Couro" }] };
      return { id: "MLB200", name: "Bolsa de Couro", buy_box_winner: { item_id: "MLB777", price: 10 } };
    });

    const result = await collectPublicListings("COLLECT");

    expect(result.ok).toBe(true);
    expect(result.stored).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("perfume");
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts[0].rows).toMatchObject({ status: "SUCCESS", stored: 1 });
    expect(runInserts[0].rows.error).toContain("perfume");
  });

  it("falha em todas as buscas: run FAILED com a mensagem (nunca silêncio)", async () => {
    mockedMlGet.mockRejectedValue(new Error("forbidden"));

    const result = await collectPublicListings("COLLECT");

    expect(result.ok).toBe(false);
    expect(result.stored).toBe(0);
    expect(result.errors).toHaveLength(2);
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts[0].rows).toMatchObject({ status: "FAILED", fetched: 0, stored: 0 });
    expect(runInserts[0].rows.error).toContain("forbidden");
  });

  it("detalhe de um produto falhando não derruba a palavra-chave; o descarte é registrado na telemetria", async () => {
    mockedMlGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/products/search") && path.includes("q=perfume")) {
        return { results: [{ id: "MLB100", name: "Perfume" }, { id: "MLB101", name: "Outro" }] };
      }
      if (path.startsWith("/products/search")) return { results: [] };
      if (path === "/products/MLB100") throw new Error("Mercado Livre respondeu HTTP 404.");
      return { id: "MLB101", name: "Outro", buy_box_winner: { item_id: "MLB888", price: 55 } };
    });

    const result = await collectPublicListings("COLLECT");

    expect(result.ok).toBe(true);
    expect(result.fetched).toBe(2);
    expect(result.stored).toBe(1);
    expect(result.errors).toEqual(["descartados: 1 (detalhe falhou: 1)"]);
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts[0].rows.status).toBe("SUCCESS");
    expect(runInserts[0].rows.error).toBe("descartados: 1 (detalhe falhou: 1)");
  });

  it("detalhe sem preço: usa a primeira oferta com preço de /items (item e permalink da oferta)", async () => {
    mockedMlGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/products/search") && path.includes("q=perfume")) {
        return { results: [{ id: "MLB100", name: "Perfume Importado 100ml" }] };
      }
      if (path.startsWith("/products/search")) return { results: [] };
      if (path === "/products/MLB100") {
        // Detalhe ok, mas SEM preço em nenhuma fonte (o caso real de 05/11/2026)
        return {
          id: "MLB100",
          name: "Perfume Importado 100ml",
          permalink: "https://www.mercadolivre.com.br/p/MLB100",
          buy_box_winner: null
        };
      }
      if (path === "/products/MLB100/items") {
        return {
          results: [
            { item_id: "MLB900", seller_id: 1 }, // sem preço: é pulada
            {
              item_id: "MLB901",
              price: 149.9,
              permalink: "https://produto.mercadolivre.com.br/MLB901",
              seller_id: 2
            }
          ]
        };
      }
      throw new Error(`Caminho inesperado: ${path}`);
    });

    const result = await collectPublicListings("COLLECT");

    expect(result).toMatchObject({ ok: true, fetched: 1, stored: 1, errors: [] });
    const allRows = insertCalls
      .filter((c) => c.table === "marketplace_trends")
      .flatMap((c) => c.rows as any[]);
    expect(allRows).toHaveLength(1);
    expect(allRows[0]).toMatchObject({
      platform: "mercado_livre",
      kind: "listing",
      keyword: "perfume",
      price: 149.9,
      listing_id: "MLB901",
      url: "https://produto.mercadolivre.com.br/MLB901"
    });
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts[0].rows).toMatchObject({ status: "SUCCESS", fetched: 1, stored: 1, error: null });
  });

  it("preço via /items sem item/permalink da oferta: cai para o id do catálogo e o permalink do produto", async () => {
    mockedMlGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/products/search") && path.includes("q=perfume")) {
        return { results: [{ id: "MLB100", name: "Perfume" }] };
      }
      if (path.startsWith("/products/search")) return { results: [] };
      if (path === "/products/MLB100") {
        return { id: "MLB100", name: "Perfume", permalink: "https://www.mercadolivre.com.br/p/MLB100" };
      }
      if (path === "/products/MLB100/items") return { results: [{ price: 42, seller_id: 7 }] };
      throw new Error(`Caminho inesperado: ${path}`);
    });

    const result = await collectPublicListings("COLLECT");

    expect(result).toMatchObject({ ok: true, fetched: 1, stored: 1 });
    const allRows = insertCalls
      .filter((c) => c.table === "marketplace_trends")
      .flatMap((c) => c.rows as any[]);
    expect(allRows[0]).toMatchObject({
      price: 42,
      listing_id: "MLB100",
      url: "https://www.mercadolivre.com.br/p/MLB100"
    });
  });

  it("/items vazio conta 'sem preço'; /items com ofertas sem preço conta 'oferta sem preço'", async () => {
    mockedMlGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/products/search") && path.includes("q=perfume")) {
        return {
          results: [
            { id: "MLB100", name: "Sem Ofertas" },
            { id: "MLB101", name: "Ofertas Sem Preço" },
            { id: "MLB102", name: "Items Falha" }
          ]
        };
      }
      if (path.startsWith("/products/search")) return { results: [] };
      if (path === "/products/MLB100") return { id: "MLB100", name: "Sem Ofertas", buy_box_winner: null };
      if (path === "/products/MLB100/items") return { results: [] };
      if (path === "/products/MLB101") return { id: "MLB101", name: "Ofertas Sem Preço" };
      if (path === "/products/MLB101/items") {
        return { results: [{ item_id: "MLB700" }, { item_id: "MLB701", price: 0 }] };
      }
      if (path === "/products/MLB102") return { id: "MLB102", name: "Items Falha" };
      if (path === "/products/MLB102/items") throw new Error("Mercado Livre respondeu HTTP 500.");
      throw new Error(`Caminho inesperado: ${path}`);
    });

    const result = await collectPublicListings("COLLECT");

    // Nada gravado, mas NADA mudo: run FAILED com o resumo contável dos motivos.
    expect(result.ok).toBe(false);
    expect(result.fetched).toBe(3);
    expect(result.stored).toBe(0);
    expect(result.errors).toEqual(["descartados: 3 (sem preço: 2, oferta sem preço: 1)"]);
    expect(insertCalls.filter((c) => c.table === "marketplace_trends")).toHaveLength(0);
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts[0].rows).toMatchObject({
      status: "FAILED",
      fetched: 3,
      stored: 0,
      error: "descartados: 3 (sem preço: 2, oferta sem preço: 1)"
    });
  });

  it("telemetria mistura motivos de várias palavras-chave num único resumo do run", async () => {
    mockedMlGet.mockImplementation(async (path: string) => {
      if (path.startsWith("/products/search") && path.includes("q=perfume")) {
        return { results: [{ id: "MLB100", name: "Detalhe Falha" }, { id: "MLB101", name: "Com Preço" }] };
      }
      if (path.startsWith("/products/search") && path.includes("q=bolsa")) {
        return { results: [{ id: "MLB200", name: "Sem Preço" }] };
      }
      if (path === "/products/MLB100") throw new Error("Mercado Livre respondeu HTTP 404.");
      if (path === "/products/MLB101") {
        return { id: "MLB101", name: "Com Preço", buy_box_winner: { item_id: "MLB888", price: 55 } };
      }
      if (path === "/products/MLB200") return { id: "MLB200", name: "Sem Preço", buy_box_winner: null };
      if (path === "/products/MLB200/items") return { results: [] };
      throw new Error(`Caminho inesperado: ${path}`);
    });

    const result = await collectPublicListings("COLLECT");

    expect(result).toMatchObject({ ok: true, fetched: 3, stored: 1 });
    expect(result.errors).toEqual(["descartados: 2 (sem preço: 1, detalhe falhou: 1)"]);
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts[0].rows).toMatchObject({
      status: "SUCCESS",
      fetched: 3,
      stored: 1,
      error: "descartados: 2 (sem preço: 1, detalhe falhou: 1)"
    });
  });
});
