import {
  exchangeMercadoLivreCode,
  mercadoLivreGet,
  persistMercadoLivreToken
} from "@/lib/mercadolivre";

function getCookie(header: string | null, name: string) {
  if (!header) return null;
  const part = header.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const expectedState = getCookie(request.headers.get("cookie"), "ml_oauth_state");

    if (!code || !state || !expectedState || state !== expectedState) {
      return Response.json({ ok: false, error: "OAuth state inválido ou code ausente." }, { status: 400 });
    }

    const token = await exchangeMercadoLivreCode(code);
    const me = await mercadoLivreGet<{ id: number; nickname?: string }>("/users/me", token.access_token);
    await persistMercadoLivreToken(token);

    return Response.json({
      ok: true,
      connected: true,
      persisted: true,
      validated: true,
      platform: "mercado_livre",
      userId: me.id,
      nickname: me.nickname ?? null,
      expiresIn: token.expires_in,
      hasRefreshToken: Boolean(token.refresh_token),
      nextStep: "Mercado Livre conectado, validado e com renovação automática preparada."
    });
  } catch (error) {
    console.error("[RL PIN][Mercado Livre callback]", error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha na autorização do Mercado Livre."
    }, { status: 500 });
  }
}
