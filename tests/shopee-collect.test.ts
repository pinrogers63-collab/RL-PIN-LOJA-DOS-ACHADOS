import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectShopeeShopItems,
  mapShopeeItemsToTrendRows,
  parseShopeeItemListPage
} from "../lib/shopee-collect";
import { getValidShopeeAccessToken } from "@/lib/shopee";
import { getSupabaseServiceRole } from "@/lib/supabase-server";

vi.mock("@/lib/shopee", async (importActual) => {
  const actual = (await importActual()) as Record<string, unknown>;
  return { ...actual, getValidShopeeAccessToken: vi.fn() };
});

vi.mock("@/lib/supabase-server", () => ({
  getSupabaseServiceRole: vi.fn()
}));

const mockedToken = getValidShopeeAccessToken as unknown as ReturnType<typeof vi.fn>;
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

function fetchReturning(handler: (url: string) => any) {
  return vi.fn(async (input: any) => {
    const url = String(input);
    return { ok: true, status: 200, json: async () => handler(url) };
  });
}

const OLD_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  process.env.SHOPEE_PARTNER_ID = "2050209";
  process.env.SHOPEE_PARTNER_KEY = "test-partner-key";
  mockedSupabase.mockReturnValue(fakeSupabase());
  mockedToken.mockResolvedValue({ accessToken: "access-123", shopId: 1121615229 });
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
});

describe("parseShopeeItemListPage", () => {
  it("extrai ids válidos e a paginação", () => {
    const page = parseShopeeItemListPage({
      response: {
        item: [{ item_id: 101 }, { item_id: "x" }, { item_id: 202 }],
        has_next_page: true,
        next_offset: 50,
        total_count: 120
      }
    });
    expect(page).toEqual({ itemIds: [101, 202], hasNextPage: true, nextOffset: 50, totalCount: 120 });
  });

  it("tolera payload vazio", () => {
    expect(parseShopeeItemListPage(null)).toEqual({ itemIds: [], hasNextPage: false, nextOffset: 0, totalCount: null });
    expect(parseShopeeItemListPage({})).toEqual({ itemIds: [], hasNextPage: false, nextOffset: 0, totalCount: null });
  });
});

describe("mapShopeeItemsToTrendRows", () => {
  it("normaliza itens da loja no formato das listagens do ML", () => {
    const rows = mapShopeeItemsToTrendRows(
      [
        { item_id: 555, item_name: "Organizador de Gavetas", price_info: [{ current_price: 39.9, original_price: 59.9 }] },
        { item_id: 556, item_name: "  ", price_info: [] },
        { item_id: 557, item_name: "Sem preço", price_info: [] }
      ],
      1121615229,
      "COLLECT",
      "2026-11-04T12:00:00.000Z"
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      platform: "shopee",
      kind: "listing",
      listing_id: "555",
      title: "Organizador de Gavetas",
      price: 39.9,
      url: "https://shopee.com.br/product/1121615229/555",
      run_type: "COLLECT"
    });
    expect(rows[1].price).toBeNull();
  });
});

describe("collectShopeeShopItems", () => {
  it("loja vazia: executa com sucesso e grava 0 itens (run SUCCESS)", async () => {
    vi.stubGlobal("fetch", fetchReturning(() => ({
      response: { item: [], has_next_page: false, next_offset: 0, total_count: 0 }
    })));
    const result = await collectShopeeShopItems("COLLECT");
    expect(result).toMatchObject({ ok: true, fetched: 0, stored: 0 });
    const trendsInserts = insertCalls.filter((c) => c.table === "marketplace_trends");
    expect(trendsInserts).toHaveLength(0);
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts).toHaveLength(1);
    expect(runInserts[0].rows).toMatchObject({ status: "SUCCESS", fetched: 0, stored: 0 });
  });

  it("coleta paginada + base info e grava listagens promovíveis", async () => {
    vi.stubGlobal("fetch", fetchReturning((url) => {
      if (url.includes("get_item_list")) {
        if (url.includes("offset=0")) {
          return { response: { item: [{ item_id: 11 }], has_next_page: true, next_offset: 50, total_count: 2 } };
        }
        return { response: { item: [{ item_id: 22 }], has_next_page: false, next_offset: 0, total_count: 2 } };
      }
      if (url.includes("get_item_base_info")) {
        const requested = decodeURIComponent(url).split("item_id_list=")[1].split("&")[0].split(",");
        const catalog: Record<string, any> = {
          "11": { item_id: 11, item_name: "Item Um", price_info: [{ current_price: 10 }] },
          "22": { item_id: 22, item_name: "Item Dois", price_info: [{ current_price: 20 }] }
        };
        return { response: { item_list: requested.map((id) => catalog[id]) } };
      }
      throw new Error(`URL inesperada: ${url}`);
    }));
    const result = await collectShopeeShopItems("REFRESH");
    expect(result).toMatchObject({ ok: true, fetched: 2, stored: 2 });
    const trendsInserts = insertCalls.filter((c) => c.table === "marketplace_trends");
    expect(trendsInserts).toHaveLength(1);
    const rows = trendsInserts[0].rows as any[];
    expect(rows.map((r) => r.listing_id).sort()).toEqual(["11", "22"]);
    expect(rows.every((r) => r.platform === "shopee" && r.kind === "listing")).toBe(true);
  });

  it("sem token válido: retorna ok:false e registra run FAILED, sem lançar", async () => {
    mockedToken.mockRejectedValue(new Error("Shopee ainda não autorizada."));
    const result = await collectShopeeShopItems("COLLECT");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/não autorizada/i);
    const runInserts = insertCalls.filter((c) => c.table === "marketplace_trend_runs");
    expect(runInserts[0].rows).toMatchObject({ status: "FAILED" });
  });
});
