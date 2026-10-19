import { getSupabaseServiceRole } from "@/lib/supabase-server";
import { toCsv } from "@/lib/csv";
import {
  INACTIVE_PRODUCT_STATUSES,
  mapProductToExport,
} from "@/lib/opportunities-export";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function parseLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parseMinScore(raw: string | null): number | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "json").toLowerCase();

  if (format !== "json" && format !== "csv") {
    return Response.json(
      {
        ok: false,
        error: "Formato inválido. Use format=json ou format=csv.",
      },
      { status: 400 }
    );
  }

  const limit = parseLimit(searchParams.get("limit"));
  const minScore = parseMinScore(searchParams.get("minScore"));

  let supabase: any;
  try {
    supabase = getSupabaseServiceRole();
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "Banco de dados indisponível. Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do servidor e execute a migration supabase/migrations/001_initial.sql.",
      },
      { status: 503 }
    );
  }

  try {
    let query = supabase
      .from("products")
      .select("title, market_price, source_url, external_id, platform, score, status")
      .not("status", "in", `(${INACTIVE_PRODUCT_STATUSES.join(",")})`)
      .order("score", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (minScore !== undefined) {
      query = query.gte("score", minScore);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map(mapProductToExport);

    if (format === "csv") {
      const csv = "\ufeff" + toCsv(items);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="oportunidades.csv"',
        },
      });
    }

    return Response.json({
      ok: true,
      count: items.length,
      limit,
      minScore: minScore ?? null,
      exportedAt: new Date().toISOString(),
      items,
    });
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "Não foi possível exportar as oportunidades agora. Tente novamente em instantes.",
      },
      { status: 500 }
    );
  }
}
