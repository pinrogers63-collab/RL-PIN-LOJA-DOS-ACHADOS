import { randomBytes } from "crypto";
import { buildMercadoLivreAuthorizationUrl } from "@/lib/mercadolivre";

export async function GET() {
  const state = randomBytes(24).toString("hex");
  const url = buildMercadoLivreAuthorizationUrl(state);

  const response = Response.redirect(url, 302);
  response.headers.append(
    "Set-Cookie",
    `ml_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
  );
  return response;
}
