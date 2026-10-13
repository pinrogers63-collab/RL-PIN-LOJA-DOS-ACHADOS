import { getValidMercadoLivreToken, mercadoLivreGet } from "@/lib/mercadolivre";

type Trend = { keyword?: string; url?: string };

async function writeTrendStore(body: Record<string, unknown>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) throw new Error("Armazenamento de tendências não configurado.");
  const response = await fetch(`${url.replace(/\/$/,"")}/functions/v1/marketplace-trend-store`,{
    method:"POST",headers:{"content-type":"application/json","x-rlpin-secret":secret},
    body:JSON.stringify(body),cache:"no-store"
  });
  if(!response.ok) throw new Error(`Falha ao registrar tendências (HTTP ${response.status}).`);
  return response.json() as Promise<{ok:boolean;found?:number;stored?:number}>;
}

export async function collectMercadoLivreTrends(runType:"COLLECT"|"REFRESH") {
  try {
    const token = await getValidMercadoLivreToken();
    const trends = await mercadoLivreGet<Trend[]>("/trends/MLB",token);
    if (!Array.isArray(trends)) throw new Error("Formato de tendências não reconhecido.");
    const cleaned = trends.slice(0,50).filter(t=>typeof t.keyword==="string").map(t=>({
      keyword:t.keyword!.trim().slice(0,180),
      url:typeof t.url==="string"?t.url:null
    })).filter(t=>t.keyword.length>0);
    const result = await writeTrendStore({action:"save_trends",run_type:runType,trends:cleaned});
    return {ok:true,source:"official_mercado_livre_trends",kind:"search_trends_not_supplier_products",
      fetched:cleaned.length,stored:result.stored??0};
  } catch (error) {
    const reason=error instanceof Error?error.message:"Erro inesperado.";
    try {await writeTrendStore({action:"log_error",run_type:runType,error:reason});} catch { /* original error retained */ }
    return {ok:false,error:reason};
  }
}
