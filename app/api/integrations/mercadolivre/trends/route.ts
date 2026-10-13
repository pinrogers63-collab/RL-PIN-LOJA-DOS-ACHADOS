import { getValidMercadoLivreToken, mercadoLivreGet } from "@/lib/mercadolivre";

type Trend = { keyword?: string; url?: string };

export async function GET() {
  try {
    const token = await getValidMercadoLivreToken();
    const data = await mercadoLivreGet<Trend[]>("/trends/MLB", token);
    if (!Array.isArray(data)) throw new Error("Formato de tendências inesperado.");
    const trends = data.slice(0, 50).filter(t => typeof t.keyword === "string").map(t => ({
      keyword: t.keyword!.slice(0, 180),
      url: typeof t.url === "string" && /^https:\/\//.test(t.url) ? t.url : null
    }));
    return Response.json({
      ok: true,
      platform: "mercado_livre",
      source: "official_trends_api",
      kind: "search_trends_not_supplier_products",
      fetchedAt: new Date().toISOString(),
      count: trends.length,
      trends
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha na consulta de tendências."
    }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
