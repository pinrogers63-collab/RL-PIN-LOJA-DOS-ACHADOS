import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectAmazonListings,
  getAmazonCollectConfig,
  mapAmazonListingsToTrendRows
} from "../lib/amazon-collect";
import { getSupabaseServiceRole } from "@/lib/supabase-server";

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServiceRole: vi.fn()
}));

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

const ENV_KEYS = [
  "AMAZON_SP_API_CLIENT_ID",
  "AMAZON_SP_API_CLIENT_SECRET",
  "AMAZON_SP_API_REFRESH_TOKEN",
  "AMAZON_SELLER_ID",
  "AMAZON_MARKETPLACE_ID"
];
const OLD_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  for (const key of ENV_KEYS) delete process.env[key];
  mockedSupabase.mockReturnValue(fakeSupabase());
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
});

describe("getAmazonCollectConfig", () => {
  it("sem auto-autorização, lista exatamente o que falta (refresh token é o passo do usuário)", () => {
    process.env.AMAZON_SP_API_CLIENT_ID = "client-id";
    process.env.AMAZON_SP_API_CLIENT_SECRET = "client-secret";
    const config = getAmazonCollectConfig();
    expect(config.ready).toBe(false);
    expect(config.missing).toEqual(["AMAZON_SP_API_REFRESH_TOKEN", "AMAZON_SELLER_ID"]);
  });

  it("com tudo definido, fica ready e usa o marketplace BR por padrão", () => {
    process.env.AMAZON_SP_API_CLIENT_ID = "client-id";
    process.env.AMAZON_SP_API_CLIENT_SECRET = "client-secret";
    process.env.AMAZON_SP_API_REFRESH_TOKEN = "refresh-token";
    process.env.AMAZON_SELLER_ID = "SELLER123";
    const config = getAmazonCollectConfig();
    expect(config.ready).toBe(true);
    expect(config.missing).toEqual([]);
    expect(config.marketplaceId).toBe("A2Q3Y263D00KWC");
  });
});

describe("mapAmazonListingsToTrendRows", () => {
  it("usa ASIN como listing_id, monta a URL e nunca inventa preço", () => {
    const rows = mapAmazonListingsToTrendRows(
      [
        { sku: "SKU-1", summaries: [{ asin: "B0CTFQMCX1", itemName: "Lavadora Alta Pressão" }] },
        { sku: "SKU-2", summaries: [{ itemName: "Sem ASIN usa SKU" }] },
        { sku: "SKU-3", summaries: [{ asin: "B000000000", itemName: "  " }] },
        { summaries: [] }
      ],
      "COLLECT",
      "2026-11-04T12:00:00.000Z"
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      platform: "amazon",
      kind: "listing",
      listing_id: "B0CTFQMCX1",
      title: "Lavadora Alta Pressão",
      price: null,
      url: "https://www.amazon.com.br/dp/B0CTFQMCX1"
    });
    expect(rows[1].listing_id).toBe("SKU-2");
    expect(rows[1].url).toBeNull();
  });
});

describe("collectAmazonListings — guarda de auto-autorização", () => {
  it("sem refresh token: no-op limpo — skipped, sem rede e sem escrita", async () => {
    process.env.AMAZON_SP_API_CLIENT_ID = "client-id";
    process.env.AMAZON_SP_API_CLIENT_SECRET = "client-secret";
    const fetchSpy = vi.fn(async () => {
      throw new Error("fetch não deveria ser chamado");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await collectAmazonListings("COLLECT");
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.missing).toContain("AMAZON_SP_API_REFRESH_TOKEN");
    expect(result.error).toMatch(/auto-autorização/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedSupabase).not.toHaveBeenCalled();
    expect(insertCalls).toHaveLength(0);
  });

  it("com refresh token: troca LWA, coleta e grava listagens promovíveis", async () => {
    process.env.AMAZON_SP_API_CLIENT_ID = "client-id";
    process.env.AMAZON_SP_API_CLIENT_SECRET = "client-secret";
    process.env.AMAZON_SP_API_REFRESH_TOKEN = "refresh-token";
    process.env.AMAZON_SELLER_ID = "SELLER123";

    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("api.amazon.com/auth/o2/token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "lwa-access" }) };
      }
      if (url.includes("/listings/2021-08-01/items/SELLER123")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [{ sku: "SKU-1", summaries: [{ asin: "B0CTFQMCX1", itemName: "Lavadora Alta Pressão" }] }],
            pagination: {}
          })
        };
      }
      throw new Error(`URL inesperada: ${url}`);
    }));

    const result = await collectAmazonListings("COLLECT");
    expect(result).toMatchObject({ ok: true, skipped: false, fetched: 1, stored: 1 });
    const trendsInserts = insertCalls.filter((c) => c.table === "marketplace_trends");
    expect(trendsInserts).toHaveLength(1);
    expect(trendsInserts[0].rows[0]).toMatchObject({ platform: "amazon", kind: "listing", listing_id: "B0CTFQMCX1" });
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts[0].rows).toMatchObject({ status: "SUCCESS", stored: 1 });
  });
});

describe("collectAmazonListings — diagnóstico da falha LWA", () => {
  // Comprimentos conhecidos de propósito: o sufixo expõe só comprimentos
  // e os 4 últimos chars do client_id (identificador) — nunca os valores.
  const CLIENT_ID = `amzn1.application.${"a".repeat(10)}WXYZ`; // len 32, suffix WXYZ
  const SECRET = "s".repeat(44);
  const REFRESH = "r".repeat(100);

  function setupFailingLwa(status: number, body: Record<string, unknown>) {
    process.env.AMAZON_SP_API_CLIENT_ID = CLIENT_ID;
    process.env.AMAZON_SP_API_CLIENT_SECRET = SECRET;
    process.env.AMAZON_SP_API_REFRESH_TOKEN = REFRESH;
    process.env.AMAZON_SELLER_ID = "SELLER123";
    vi.stubGlobal("fetch", vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("api.amazon.com/auth/o2/token")) {
        return { ok: false, status, json: async () => body };
      }
      throw new Error(`URL inesperada: ${url}`);
    }));
  }

  it("invalid_client: mensagem traz o sufixo completo com código, http e comprimentos", async () => {
    setupFailingLwa(400, { error: "invalid_client", error_description: "Client authentication failed" });

    const result = await collectAmazonListings("COLLECT");
    const expected =
      "Client authentication failed" +
      " [lwa_error=invalid_client; http=400; client_id_suffix=WXYZ; client_id_len=32; secret_len=44; refresh_token_len=100]";
    expect(result.ok).toBe(false);
    expect(result.error).toBe(expected);
    // O segredo e o token nunca aparecem na mensagem.
    expect(result.error).not.toContain(SECRET);
    expect(result.error).not.toContain(REFRESH);
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts[0].rows).toMatchObject({ status: "FAILED" });
    expect(runInserts[0].rows.error).toBe(`amazon: ${expected}`);
  });

  it("sem campo error na resposta: sufixo usa sem_codigo", async () => {
    setupFailingLwa(400, { error_description: "Client authentication failed" });

    const result = await collectAmazonListings("COLLECT");
    expect(result.error).toBe(
      "Client authentication failed" +
        " [lwa_error=sem_codigo; http=400; client_id_suffix=WXYZ; client_id_len=32; secret_len=44; refresh_token_len=100]"
    );
  });

  it("sem error_description: mantém o fallback HTTP antes do sufixo", async () => {
    setupFailingLwa(401, {});

    const result = await collectAmazonListings("COLLECT");
    expect(result.error).toBe(
      "LWA respondeu HTTP 401." +
        " [lwa_error=sem_codigo; http=401; client_id_suffix=WXYZ; client_id_len=32; secret_len=44; refresh_token_len=100]"
    );
  });
});
