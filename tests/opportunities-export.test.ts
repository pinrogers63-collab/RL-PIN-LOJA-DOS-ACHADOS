import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapProductToExport } from "../lib/opportunities-export";
import { GET } from "../app/api/opportunities/export/route";
import { getSupabaseServiceRole } from "@/lib/supabase-server";

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServiceRole: vi.fn(),
}));

const mockedGetSupabase = getSupabaseServiceRole as unknown as ReturnType<typeof vi.fn>;

type Chain = {
  _calls: Record<string, unknown[][]>;
  then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => void;
};

function makeChain(result: { data: unknown[]; error: unknown }): Chain & Record<string, unknown> {
  const calls: Record<string, unknown[][]> = {};
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "select", "not", "order", "limit", "gte"]) {
    calls[m] = [];
    chain[m] = (...args: unknown[]) => {
      calls[m].push(args);
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => void) => {
    Promise.resolve(result).then(resolve);
  };
  chain._calls = calls;
  return chain as Chain & Record<string, unknown>;
}

const sampleRows = [
  {
    title: "Perfume Importado 100ml",
    market_price: 199.9,
    source_url: "https://produto.mercadolivre.com.br/MLB123",
    external_id: "MLB123",
    platform: "mercado_livre",
    score: 88,
    status: "APROVADO",
  },
  {
    title: "Bolsa Vintage",
    market_price: 78,
    source_url: null,
    external_id: null,
    platform: "shopee",
    score: 72,
    status: "NOVO",
  },
];

function mockDb(rows: unknown[] = sampleRows, error: unknown = null) {
  const chain = makeChain({ data: rows, error });
  mockedGetSupabase.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mapProductToExport", () => {
  it("mapeia todos os campos disponíveis e preenche com null o que não existe", () => {
    expect(mapProductToExport(sampleRows[0])).toEqual({
      name: "Perfume Importado 100ml",
      price: 199.9,
      currencyCode: "BRL",
      commissionPercent: null,
      commissionAmount: null,
      affiliateLink: null,
      landingPageUrl: null,
      evidenceUrl: "https://produto.mercadolivre.com.br/MLB123",
      externalOfferId: "MLB123",
      category: null,
    });
  });

  it("normaliza strings vazias e preços inválidos para null", () => {
    expect(
      mapProductToExport({
        title: "  ",
        market_price: "abc",
        source_url: "",
        external_id: "",
        platform: null,
        score: null,
        status: null,
      })
    ).toEqual({
      name: null,
      price: null,
      currencyCode: "BRL",
      commissionPercent: null,
      commissionAmount: null,
      affiliateLink: null,
      landingPageUrl: null,
      evidenceUrl: null,
      externalOfferId: null,
      category: null,
    });
  });
});

describe("GET /api/opportunities/export", () => {
  it("retorna JSON com os produtos mapeados por padrão", async () => {
    mockDb();
    const res = await GET(new Request("http://localhost/api/opportunities/export"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(2);
    expect(body.items[0].name).toBe("Perfume Importado 100ml");
    expect(body.items[0].evidenceUrl).toBe("https://produto.mercadolivre.com.br/MLB123");
    expect(body.items[1].commissionPercent).toBeNull();
  });

  it("retorna CSV com header e content-type text/csv", async () => {
    mockDb();
    const res = await GET(new Request("http://localhost/api/opportunities/export?format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    const [header, ...lines] = text.replace(/^\ufeff/, "").split("\n");
    expect(header).toBe(
      '"name","price","currencyCode","commissionPercent","commissionAmount","affiliateLink","landingPageUrl","evidenceUrl","externalOfferId","category"'
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Perfume Importado 100ml");
  });

  it("rejeita formato inválido com 400", async () => {
    mockDb();
    const res = await GET(new Request("http://localhost/api/opportunities/export?format=xml"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("retorna 503 em pt-BR quando o Supabase não está configurado", async () => {
    mockedGetSupabase.mockImplementation(() => {
      throw new Error("sem config");
    });
    const res = await GET(new Request("http://localhost/api/opportunities/export"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/banco de dados indisponível/i);
  });

  it("limita o máximo a 500 e aplica minScore", async () => {
    const chain = mockDb();
    await GET(new Request("http://localhost/api/opportunities/export?limit=999&minScore=80"));
    expect(chain._calls["limit"][0]).toEqual([500]);
    expect(chain._calls["gte"][0]).toEqual(["score", 80]);
  });

  it("usa limite padrão 50 quando não informado", async () => {
    const chain = mockDb();
    await GET(new Request("http://localhost/api/opportunities/export"));
    expect(chain._calls["limit"][0]).toEqual([50]);
    expect(chain._calls["gte"]).toHaveLength(0);
  });
});
