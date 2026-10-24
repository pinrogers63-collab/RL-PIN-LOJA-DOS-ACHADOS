import { exchangeCodeForTokens, persistShopeeToken } from "@/lib/shopee";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const shopId = Number(url.searchParams.get("shop_id"));

    if (!code || !Number.isInteger(shopId) || shopId <= 0) {
      return Response.json(
        { ok: false, error: "Code ou shop_id ausente na resposta da Shopee." },
        { status: 400 }
      );
    }

    const token = await exchangeCodeForTokens(code, shopId);
    await persistShopeeToken(token, shopId);

    return Response.json({
      ok: true,
      connected: true,
      persisted: true,
      platform: "shopee",
      shopId,
      expiresIn: token.expire_in,
      hasRefreshToken: Boolean(token.refresh_token),
      nextStep: "Shopee conectada, com token persistido e renovação preparada."
    });
  } catch (error) {
    console.error("[RL PIN][Shopee callback]", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha na autorização da Shopee."
      },
      { status: 500 }
    );
  }
}
