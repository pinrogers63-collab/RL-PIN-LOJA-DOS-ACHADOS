import { getMercadoLivrePublicConfig } from "@/lib/mercadolivre";

export async function GET() {
  const config = getMercadoLivrePublicConfig();
  return Response.json({
    ok: true,
    platform: "mercado_livre",
    configured: config.clientIdConfigured && config.clientSecretConfigured,
    clientIdConfigured: config.clientIdConfigured,
    clientSecretConfigured: config.clientSecretConfigured,
    redirectUri: config.redirectUri,
    webhookUrl: config.webhookUrl
  });
}
