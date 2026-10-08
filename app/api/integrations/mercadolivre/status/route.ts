import {
  getStoredMercadoLivreToken,
  getValidMercadoLivreToken,
  mercadoLivreGet
} from "@/lib/mercadolivre";

export async function GET() {
  try {
    const stored = await getStoredMercadoLivreToken();
    if (!stored) return Response.json({ ok: true, connected: false, platform: "mercado_livre" });

    const accessToken = await getValidMercadoLivreToken();
    const me = await mercadoLivreGet<{ id: number; nickname?: string }>("/users/me", accessToken);

    return Response.json({
      ok: true,
      connected: true,
      persisted: true,
      validated: true,
      platform: "mercado_livre",
      userId: me.id,
      nickname: me.nickname ?? null,
      tokenRefreshReady: Boolean(stored.refresh_token)
    });
  } catch (error) {
    return Response.json({
      ok: false,
      connected: false,
      platform: "mercado_livre",
      error: error instanceof Error ? error.message : "Falha ao validar Mercado Livre."
    }, { status: 500 });
  }
}
