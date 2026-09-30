import { exchangeMercadoLivreCode } from "@/lib/mercadolivre";

function getCookie(header: string | null, name: string) {
  if (!header) return null;
  const part = header.split(";").map(v=>v.trim()).find(v=>v.startsWith(name+"="));
  return part ? decodeURIComponent(part.slice(name.length+1)) : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = getCookie(request.headers.get("cookie"), "ml_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return Response.json({ ok:false, error:"OAuth state inválido ou code ausente." }, { status:400 });
  }

  const token = await exchangeMercadoLivreCode(code);

  return Response.json({
    ok:true,
    connected:true,
    platform:"mercado_livre",
    userId:token.user_id,
    expiresIn:token.expires_in,
    hasRefreshToken:Boolean(token.refresh_token),
    nextStep:"Persistir tokens de forma segura no backend e validar /users/me."
  });
}
