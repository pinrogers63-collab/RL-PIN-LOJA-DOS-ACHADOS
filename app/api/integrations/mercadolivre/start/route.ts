import { randomBytes } from "crypto";
import { buildMercadoLivreAuthorizationUrl } from "@/lib/mercadolivre";

export async function GET() {
  const state = randomBytes(24).toString("hex");
  const url = buildMercadoLivreAuthorizationUrl(state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Set-Cookie": `ml_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
    }
  });
}
