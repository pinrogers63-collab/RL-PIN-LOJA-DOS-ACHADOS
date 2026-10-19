import { connectors } from "@/lib/connectors";
import { getValidMercadoLivreToken, mercadoLivreGet } from "@/lib/mercadolivre";

// Credentials alone never prove that a marketplace connection works.
// This endpoint reports a connection only after a successful authenticated API request.
export async function GET() {
  let mlConnected = false;
  let mlStatus: "verified" | "unavailable" = "unavailable";
  try {
    const token = await getValidMercadoLivreToken();
    const account = await mercadoLivreGet<{ id?: number }>("/users/me", token);
    mlConnected = typeof account.id === "number";
    if (mlConnected) mlStatus = "verified";
  } catch {
    // Never expose tokens or upstream errors in this public response.
  }

  const configured: Record<string, boolean> = {
    shopee: Boolean(process.env.SHOPEE_PARTNER_ID && process.env.SHOPEE_PARTNER_KEY && process.env.SHOPEE_SHOP_ID),
    tiktok: Boolean(process.env.TIKTOK_SHOP_APP_KEY && process.env.TIKTOK_SHOP_APP_SECRET),
    pinterest: Boolean(process.env.PINTEREST_APP_ID && process.env.PINTEREST_APP_SECRET),
    amazon: Boolean(process.env.AMAZON_SP_API_CLIENT_ID && process.env.AMAZON_SP_API_CLIENT_SECRET)
  };

  const runtime = connectors.map((connector) => {
    if (connector.id === "mercado_livre") {
      return { ...connector, connected: mlConnected, verification: mlStatus };
    }
    if (Object.prototype.hasOwnProperty.call(configured, connector.id)) {
      return {
        ...connector,
        connected: false,
        configured: configured[connector.id],
        verification: "not_tested" as const
      };
    }
    return { ...connector, connected: false, verification: "not_tested" as const };
  });

  return Response.json(
    { ok: true, count: runtime.length, connectors: runtime },
    { headers: { "Cache-Control": "no-store" } }
  );
}
