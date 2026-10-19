import { getValidMercadoLivreToken, mercadoLivreGet } from "@/lib/mercadolivre";
import { getSupabaseServiceRole } from "@/lib/supabase-server";

type Trend = { keyword?: string; url?: string };

type SaveTrendsInput = {
  action: "save_trends";
  run_type: "COLLECT" | "REFRESH";
  trends: Array<{ keyword: string; url: string | null }>;
};

type LogErrorInput = {
  action: "log_error";
  run_type: "COLLECT" | "REFRESH";
  error: string;
};

type WriteTrendStoreInput = SaveTrendsInput | LogErrorInput;

/**
 * Persiste tendências oficiais e erros de coleta diretamente nas tabelas
 * marketplace_trends / marketplace_trend_runs (service role, server-side).
 * Substitui a Edge Function marketplace-trend-store (inexistente no deploy).
 * Interface pública mantida intacta.
 */
async function writeTrendStore(
  body: WriteTrendStoreInput
): Promise<{ ok: boolean; stored?: number }> {
  const supabase = getSupabaseServiceRole();
  const capturedAt = new Date().toISOString();

  if (body.action === "save_trends") {
    const rows = body.trends.map((t) => ({
      platform: "mercado_livre",
      keyword: t.keyword,
      url: t.url,
      kind: "trend",
      run_type: body.run_type,
      captured_at: capturedAt
    }));
    let stored = 0;
    if (rows.length > 0) {
      const { error } = await supabase.from("marketplace_trends").insert(rows);
      if (error) throw new Error(`Falha ao registrar tendências: ${error.message}`);
      stored = rows.length;
    }
    const { error: runError } = await supabase.from("marketplace_trend_runs").insert({
      run_type: body.run_type,
      status: "SUCCESS",
      fetched: rows.length,
      stored
    });
    if (runError) throw new Error(`Falha ao registrar execução: ${runError.message}`);
    return { ok: true, stored };
  }

  const { error } = await supabase.from("marketplace_trend_runs").insert({
    run_type: body.run_type,
    status: "FAILED",
    fetched: 0,
    stored: 0,
    error: body.error
  });
  if (error) throw new Error(`Falha ao registrar erro de coleta: ${error.message}`);
  return { ok: true };
}

export async function collectMercadoLivreTrends(runType: "COLLECT" | "REFRESH") {
  try {
    const token = await getValidMercadoLivreToken();
    const trends = await mercadoLivreGet<Trend[]>("/trends/MLB", token);
    if (!Array.isArray(trends)) throw new Error("Formato de tendências não reconhecido.");
    const cleaned = trends.slice(0, 50).filter(t => typeof t.keyword === "string").map(t => ({
      keyword: t.keyword!.trim().slice(0, 180),
      url: typeof t.url === "string" ? t.url : null
    })).filter(t => t.keyword.length > 0);
    const result = await writeTrendStore({ action: "save_trends", run_type: runType, trends: cleaned });
    return {
      ok: true, source: "official_mercado_livre_trends", kind: "search_trends_not_supplier_products",
      fetched: cleaned.length, stored: result.stored ?? 0
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Erro inesperado.";
    try { await writeTrendStore({ action: "log_error", run_type: runType, error: reason }); } catch { /* original error retained */ }
    return { ok: false, error: reason };
  }
}
