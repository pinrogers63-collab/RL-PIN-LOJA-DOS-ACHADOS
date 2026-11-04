import { describe, expect, it } from "vitest";
import {
  dedupeStoredListings,
  initialListingScore,
  mapStoredListingToProduct,
  promoteStoredListings,
  promotedStatus,
  type StoredListingRow
} from "../lib/product-promotion";
import { productFingerprint } from "../lib/scoring";
import { INACTIVE_PRODUCT_STATUSES, mapProductToExport } from "../lib/opportunities-export";

function listing(overrides: Partial<StoredListingRow> = {}): StoredListingRow {
  return {
    platform: "mercado_livre",
    url: "https://produto.mercadolivre.com.br/MLB1",
    title: "Perfume Importado 100ml",
    price: 199.9,
    listing_id: "MLB1",
    kind: "listing",
    captured_at: "2026-11-04T12:00:00.000Z",
    ...overrides
  };
}

function makeFakeSupabase({ trends = [] as StoredListingRow[], existing = [] as any[] } = {}) {
  const inserted: any[] = [];
  const updated: Array<{ id: unknown; patch: any }> = [];
  function builder(table: string) {
    const state: any = { mode: "select", patch: null };
    const b: any = {
      select: () => b,
      eq: (_col: string, val: unknown) => {
        if (state.mode === "update") updated.push({ id: val, patch: state.patch });
        return b;
      },
      in: () => b,
      order: () => b,
      limit: () => b,
      insert: (rows: any) => {
        state.mode = "insert";
        inserted.push(...(Array.isArray(rows) ? rows : [rows]));
        return b;
      },
      update: (patch: any) => {
        state.mode = "update";
        state.patch = patch;
        return b;
      },
      then: (resolve: any, reject: any) => {
        const result =
          table === "marketplace_trends"
            ? { data: trends, error: null }
            : table === "products" && state.mode === "select"
              ? { data: existing, error: null }
              : { data: null, error: null };
        return Promise.resolve(result).then(resolve, reject);
      }
    };
    return b;
  }
  return { client: { from: (t: string) => builder(t) }, inserted, updated };
}

describe("dedupeStoredListings", () => {
  it("deduplica por platform+listing_id mantendo a captura mais recente e contando ocorrências", () => {
    const rows = [
      listing({ captured_at: "2026-11-04T12:00:00.000Z", price: 189.9 }),
      listing({ captured_at: "2026-11-03T12:00:00.000Z", price: 199.9 }),
      listing({ captured_at: "2026-11-02T12:00:00.000Z", price: 209.9 })
    ];
    const deduped = dedupeStoredListings(rows);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].occurrences).toBe(3);
    expect(deduped[0].row.price).toBe(189.9);
  });

  it("ignora tendências, linhas sem listing_id/título e separa plataformas", () => {
    const rows = [
      listing({ kind: "trend", listing_id: null }),
      listing({ listing_id: " " }),
      listing({ title: null }),
      listing(),
      listing({ platform: "shopee", listing_id: "MLB1" })
    ];
    const deduped = dedupeStoredListings(rows);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((d) => d.row.platform).sort()).toEqual(["mercado_livre", "shopee"]);
  });
});

describe("initialListingScore e promotedStatus", () => {
  it("é determinístico e cresce com a recorrência do anúncio", () => {
    expect(initialListingScore(1).score).toBe(48);
    expect(initialListingScore(1).score).toBe(initialListingScore(1).score);
    expect(initialListingScore(7).score).toBe(61);
    expect(initialListingScore(50).score).toBe(initialListingScore(7).score);
  });

  it("status de entrada é NOVO ou OBSERVAR, nunca EM_ALTA/APROVADO", () => {
    expect(promotedStatus(57)).toBe("NOVO");
    expect(promotedStatus(58)).toBe("OBSERVAR");
    expect(promotedStatus(100)).toBe("OBSERVAR");
  });
});

describe("mapStoredListingToProduct", () => {
  it("mapeia os campos do upsert com custo/estoque zerados (desconhecidos) e fingerprint estável", () => {
    const product = mapStoredListingToProduct({ row: listing(), occurrences: 1 });
    expect(product).toMatchObject({
      platform: "mercado_livre",
      external_id: "MLB1",
      source_url: "https://produto.mercadolivre.com.br/MLB1",
      title: "Perfume Importado 100ml",
      cost: 0,
      market_price: 199.9,
      stock: 0,
      score: 48,
      status: "NOVO",
      supplier_id: null,
      sku: null
    });
    expect(product.fingerprint).toBe(
      productFingerprint({
        platform: "mercado_livre",
        externalId: "MLB1",
        sku: undefined,
        sourceUrl: "https://produto.mercadolivre.com.br/MLB1",
        title: "Perfume Importado 100ml"
      })
    );
  });

  it("normaliza preço inválido para 0 e título com espaços", () => {
    const product = mapStoredListingToProduct({
      row: listing({ price: "abc" as any, title: "  Bolsa Couro  " }),
      occurrences: 1
    });
    expect(product.market_price).toBe(0);
    expect(product.title).toBe("Bolsa Couro");
  });
});

describe("promoteStoredListings", () => {
  it("sem listagens armazenadas, não insere nada e retorna ok", async () => {
    const fake = makeFakeSupabase();
    const result = await promoteStoredListings({ supabase: fake.client });
    expect(result).toMatchObject({ ok: true, examined: 0, candidates: 0, inserted: 0, updated: 0 });
    expect(fake.inserted).toHaveLength(0);
  });

  it("insere anúncios novos já deduplicados", async () => {
    const fake = makeFakeSupabase({
      trends: [
        listing(),
        listing({ captured_at: "2026-11-03T12:00:00.000Z" }),
        listing({ listing_id: "MLB2", title: "Bolsa Couro", url: "https://produto.mercadolivre.com.br/MLB2" })
      ]
    });
    const result = await promoteStoredListings({ supabase: fake.client });
    expect(result).toMatchObject({ ok: true, examined: 3, candidates: 2, inserted: 2, updated: 0 });
    expect(fake.inserted.map((p) => p.external_id).sort()).toEqual(["MLB1", "MLB2"]);
    // MLB1 apareceu 2x → momentum maior que o de MLB2 (1x).
    const mlb1 = fake.inserted.find((p) => p.external_id === "MLB1");
    const mlb2 = fake.inserted.find((p) => p.external_id === "MLB2");
    expect(mlb1.score).toBeGreaterThan(mlb2.score);
  });

  it("atualiza preço de produto NOVO recalculando score, mas preserva decisão humana (APROVADO)", async () => {
    const fake = makeFakeSupabase({
      trends: [listing(), listing({ listing_id: "MLB2", title: "Bolsa Couro" })],
      existing: [
        { id: "p1", platform: "mercado_livre", external_id: "MLB1", status: "NOVO" },
        { id: "p2", platform: "mercado_livre", external_id: "MLB2", status: "APROVADO" }
      ]
    });
    const result = await promoteStoredListings({ supabase: fake.client });
    expect(result).toMatchObject({ ok: true, inserted: 0, updated: 2 });
    const novo = fake.updated.find((u) => u.id === "p1");
    const aprovado = fake.updated.find((u) => u.id === "p2");
    expect(novo?.patch).toHaveProperty("score");
    expect(novo?.patch).toHaveProperty("status");
    expect(aprovado?.patch).not.toHaveProperty("score");
    expect(aprovado?.patch).not.toHaveProperty("status");
    expect(aprovado?.patch).toHaveProperty("market_price");
  });

  it("não ressuscita produto DESCARTADO pelo humano", async () => {
    const fake = makeFakeSupabase({
      trends: [listing()],
      existing: [{ id: "p9", platform: "mercado_livre", external_id: "MLB1", status: "DESCARTADO" }]
    });
    const result = await promoteStoredListings({ supabase: fake.client });
    expect(result).toMatchObject({ ok: true, inserted: 0, updated: 0, skipped: 1 });
    expect(fake.inserted).toHaveLength(0);
    expect(fake.updated).toHaveLength(0);
  });

  it("produto promovido satisfaz o contrato do export (deixa de ser vazio)", async () => {
    const fake = makeFakeSupabase({ trends: [listing()] });
    await promoteStoredListings({ supabase: fake.client });
    const promoted = fake.inserted[0];
    expect(INACTIVE_PRODUCT_STATUSES).not.toContain(promoted.status);
    const exported = mapProductToExport({
      title: promoted.title,
      market_price: promoted.market_price,
      source_url: promoted.source_url,
      external_id: promoted.external_id,
      platform: promoted.platform,
      score: promoted.score,
      status: promoted.status
    });
    expect(exported.name).toBe("Perfume Importado 100ml");
    expect(exported.price).toBe(199.9);
    expect(exported.externalOfferId).toBe("MLB1");
    expect(exported.evidenceUrl).toBe("https://produto.mercadolivre.com.br/MLB1");
  });
});
