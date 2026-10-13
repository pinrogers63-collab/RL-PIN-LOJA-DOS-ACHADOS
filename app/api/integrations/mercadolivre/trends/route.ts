import { getValidMercadoLivreToken, mercadoLivreGet } from "@/lib/mercadolivre";
import { createClient } from "@supabase/supabase-js";

type Trend = { keyword?: string; url?: string };

export async function GET(request: Request) {
  const bearer = request.headers.get("authorization");
  const userToken = bearer?.startsWith("Bearer ") ? bearer.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!userToken || !url || !key) return Response.json({ ok:false, error:"Sessão necessária." },{status:401});
  const authClient = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError} = await authClient.auth.getUser(userToken);
  if (authError || !auth.user) return Response.json({ok:false,error:"Sessão inválida."},{status:401});
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
