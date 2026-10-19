import { randomBytes } from "crypto";
import { buildMercadoLivreAuthorizationUrl } from "@/lib/mercadolivre";

export async function GET() {
  try {
    const state = randomBytes(24).toString("hex");
    const url = buildMercadoLivreAuthorizationUrl(state);

    return new Response(null, {
      status: 302,
      headers: {
        Location: url,
        "Set-Cookie": `ml_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
      }
    });
  } catch (error) {
    const missingCredentials =
      error instanceof Error && /credenciais/i.test(error.message);
    return Response.json(
      {
        ok: false,
        error: missingCredentials
          ? "Integração com o Mercado Livre ainda não configurada. Cadastre o Client ID e o Client Secret nas variáveis de ambiente (MERCADOLIVRE_CLIENT_ID e MERCADOLIVRE_CLIENT_SECRET) e tente novamente."
          : "Não foi possível iniciar a autorização com o Mercado Livre. Tente novamente em instantes."
      },
      { status: 503 }
    );
  }
}
