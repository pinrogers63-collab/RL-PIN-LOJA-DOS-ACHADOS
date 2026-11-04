import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseTrendKeywords, mapPublicSearchResults, collectPublicListings } from "../lib/ml-public-collect";
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

describe("collectPublicListings (busca autenticada)", () => {
  it("busca com o token OAuth válido e grava listagens kind=listing + run SUCCESS", async () => {
    mockedMlGet.mockImplementation(async (path: string) => {
      if (path.includes("q=perfume")) {
        return { results: [{ id: "MLB1", title: "Perfume Bom", price: 99.9, permalink: "https://x/MLB1" }] };
      }
      return { results: [{ id: "MLB2", title: "Bolsa Couro", price: 149.9, permalink: "https://x/MLB2" }] };
    });

    const result = await collectPublicListings("COLLECT");

    expect(mockedToken).toHaveBeenCalledTimes(1);
    expect(mockedMlGet).toHaveBeenCalledTimes(2);
    const paths = mockedMlGet.mock.calls.map((c) => String(c[0]));
    expect(paths[0]).toContain("/sites/MLB/search?q=perfume&limit=20");
    expect(paths[1]).toContain("/sites/MLB/search?q=bolsa&limit=20");
    expect(mockedMlGet.mock.calls.every((c) => c[1] === "access-token-123")).toBe(true);

    expect(result).toMatchObject({ ok: true, kind: "authenticated_listings_oauth", fetched: 2, stored: 2, errors: [] });
    const trendsInserts = insertCalls.filter((c) => c.table === "marketplace_trends");
    expect(trendsInserts).toHaveLength(2);
    const allRows = trendsInserts.flatMap((c) => c.rows as any[]);
    expect(allRows.map((r) => r.listing_id).sort()).toEqual(["MLB1", "MLB2"]);
    expect(allRows.every((r) => r.platform === "mercado_livre" && r.kind === "listing" && r.run_type === "COLLECT")).toBe(true);
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts).toHaveLength(1);
    expect(runInserts[0].rows).toMatchObject({ run_type: "COLLECT", status: "SUCCESS", fetched: 2, stored: 2, error: null });
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
      return { results: [{ id: "MLB7", title: "Bolsa Ok", price: 10 }] };
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
});
