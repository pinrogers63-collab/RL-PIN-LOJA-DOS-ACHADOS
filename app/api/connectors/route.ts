import { connectors } from "@/lib/connectors";
import { getStoredMercadoLivreToken } from "@/lib/mercadolivre";

export async function GET() {
  let mlConnected = false;
  try {
    mlConnected = Boolean(await getStoredMercadoLivreToken());
  } catch {}

  const runtime = connectors.map((c) => {
    if (c.id === "mercado_livre") return { ...c, connected: mlConnected };
    if (c.id === "shopee") return { ...c, connected: Boolean(process.env.SHOPEE_PARTNER_ID && process.env.SHOPEE_PARTNER_KEY && process.env.SHOPEE_SHOP_ID) };
    if (c.id === "tiktok") return { ...c, connected: Boolean(process.env.TIKTOK_SHOP_APP_KEY && process.env.TIKTOK_SHOP_APP_SECRET) };
    if (c.id === "pinterest") return { ...c, connected: Boolean(process.env.PINTEREST_APP_ID && process.env.PINTEREST_APP_SECRET) };
    return c;
  });

  return Response.json({ ok: true, count: runtime.length, connectors: runtime });
}
