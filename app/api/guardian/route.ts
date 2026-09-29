import { runGuardian } from "@/lib/guardian";
import type { Product } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as Product;

  if (!body?.title || !body?.platform) {
    return Response.json(
      { ok: false, error: "Produto inválido para análise do Guardião RL." },
      { status: 400 }
    );
  }

  return Response.json({
    ok: true,
    result: runGuardian(body)
  });
}
