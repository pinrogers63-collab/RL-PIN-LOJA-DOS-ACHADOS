import {
  getStoredMercadoLivreToken,
  getValidMercadoLivreToken,
  mercadoLivreGet
} from "@/lib/mercadolivre";

// This endpoint is used by the operations dashboard. Never expose account
// identifiers, token metadata, or upstream error details to anonymous visitors.
const responseOptions = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  try {
    const stored = await getStoredMercadoLivreToken();
    if (!stored) {
      return Response.json(
        { ok: true, connected: false, validated: false, platform: "mercado_livre" },
        responseOptions
      );
    }

    const accessToken = await getValidMercadoLivreToken();
    const me = await mercadoLivreGet<{ id?: number }>("/users/me", accessToken);
    const validated = typeof me.id === "number";

    return Response.json(
      { ok: validated, connected: validated, validated, platform: "mercado_livre" },
      responseOptions
    );
  } catch {
    return Response.json(
      { ok: false, connected: false, validated: false, platform: "mercado_livre", error: "Não foi possível validar a conexão." },
      { status: 503, ...responseOptions }
    );
  }
}
