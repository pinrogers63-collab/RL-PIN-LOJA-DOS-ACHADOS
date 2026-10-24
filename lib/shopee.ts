import { createHmac } from "crypto";
import { getSupabaseServiceRole } from "./supabase-server";

const SHOPEE_API_BASE = "https://partner.shopeemobile.com";
const SHOPEE_AUTH_PATH = "/api/v2/shop/auth_partner";
const SHOPEE_TOKEN_PATH = "/api/v2/auth/token/get";
const DEFAULT_APP_URL = "https://rl-pin-loja-dos-achados.vercel.app";

type ShopeeToken = {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  shop_id_list?: number[];
  merchant_id_list?: number[];
};

/**
 * Persistência de tokens via tabela marketplace_tokens (service role, server-side),
 * mesmo padrão do Mercado Livre. A shop autorizada fica em external_user_id.
 */

export function getShopeePublicConfig() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
  const redirectUri = process.env.SHOPEE_REDIRECT_URI || `${appUrl}/api/integrations/shopee/callback`;
  return {
    appUrl,
    redirectUri,
    partnerIdConfigured: Boolean(process.env.SHOPEE_PARTNER_ID),
    partnerKeyConfigured: Boolean(process.env.SHOPEE_PARTNER_KEY)
  };
}

export function getShopeeConfig() {
  const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
  const partnerKey = process.env.SHOPEE_PARTNER_KEY;
  const { redirectUri } = getShopeePublicConfig();
  if (!Number.isInteger(partnerId) || partnerId <= 0 || !partnerKey) {
    throw new Error("Credenciais da Shopee ainda não configuradas.");
  }
  return { partnerId, partnerKey, redirectUri };
}

/** Assinatura HMAC-SHA256 exigida pela Shopee: base = partner_id + path + timestamp. */
export function signShopee(partnerId: number, path: string, timestamp: number, partnerKey: string) {
  const baseString = `${partnerId}${path}${timestamp}`;
  return createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

export function buildShopAuthUrl(timestamp = Math.floor(Date.now() / 1000)) {
  const { partnerId, partnerKey, redirectUri } = getShopeeConfig();
  const sign = signShopee(partnerId, SHOPEE_AUTH_PATH, timestamp, partnerKey);
  const url = new URL(`${SHOPEE_API_BASE}${SHOPEE_AUTH_PATH}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);
  url.searchParams.set("redirect", redirectUri);
  return url.toString();
}

export async function exchangeCodeForTokens(code: string, shopId: number): Promise<ShopeeToken> {
  const { partnerId, partnerKey } = getShopeeConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShopee(partnerId, SHOPEE_TOKEN_PATH, timestamp, partnerKey);
  const url = new URL(`${SHOPEE_API_BASE}${SHOPEE_TOKEN_PATH}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ code, shop_id: shopId, partner_id: partnerId }),
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || data?.error || !data?.access_token) {
    throw new Error(data?.message ?? "Falha ao obter token da Shopee.");
  }
  return data as ShopeeToken;
}

export function buildShopeeTokenRow(token: ShopeeToken, shopId: number) {
  return {
    platform: "shopee",
    external_user_id: String(shopId),
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    token_type: "Bearer",
    scope: null,
    expires_at: new Date(Date.now() + token.expire_in * 1000).toISOString(),
    updated_at: new Date().toISOString()
  };
}

export async function persistShopeeToken(token: ShopeeToken, shopId: number) {
  const supabase = getSupabaseServiceRole();
  const { error } = await supabase
    .from("marketplace_tokens")
    .upsert(buildShopeeTokenRow(token, shopId), { onConflict: "platform" });
  if (error) throw new Error(`Falha ao persistir token da Shopee: ${error.message}`);
}
