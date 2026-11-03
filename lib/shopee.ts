import { createHmac } from "crypto";
import { getSupabaseServiceRole } from "./supabase-server";

const SHOPEE_API_BASE = "https://partner.shopeemobile.com";
const SHOPEE_AUTH_PATH = "/api/v2/shop/auth_partner";
const SHOPEE_TOKEN_PATH = "/api/v2/auth/token/get";
const SHOPEE_REFRESH_PATH = "/api/v2/auth/access_token/get";
const SHOPEE_SHOP_INFO_PATH = "/api/v2/shop/get_shop_info";
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

/**
 * Validação ao vivo da conexão (mesmo padrão do Mercado Livre):
 * lê o token persistido da loja autorizada, renova via refresh_token se
 * estiver expirando e confirma com uma chamada real a get_shop_info.
 * Qualquer falha resulta em "não verificado" — nunca em exceção para o chamador.
 */

export type StoredShopeeToken = {
  shopId: number;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
};

export function mapStoredShopeeToken(row: Record<string, any> | null): StoredShopeeToken | null {
  if (!row) return null;
  const shopId = Number(row.external_user_id);
  if (!Number.isInteger(shopId) || shopId <= 0 || !row.access_token) return null;
  return {
    shopId,
    accessToken: row.access_token,
    refreshToken: row.refresh_token ?? null,
    expiresAt: row.expires_at
  };
}

/**
 * Assinatura das chamadas em nível de loja:
 * base = partner_id + path + timestamp + access_token + shop_id.
 */
export function signShopeeShopRequest(
  partnerId: number,
  path: string,
  timestamp: number,
  accessToken: string,
  shopId: number,
  partnerKey: string
) {
  const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
  return createHmac("sha256", partnerKey).update(baseString).digest("hex");
}

export function buildGetShopInfoUrl(
  accessToken: string,
  shopId: number,
  timestamp = Math.floor(Date.now() / 1000)
) {
  const { partnerId, partnerKey } = getShopeeConfig();
  const sign = signShopeeShopRequest(partnerId, SHOPEE_SHOP_INFO_PATH, timestamp, accessToken, shopId, partnerKey);
  const url = new URL(`${SHOPEE_API_BASE}${SHOPEE_SHOP_INFO_PATH}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("shop_id", String(shopId));
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("sign", sign);
  return url.toString();
}

async function getStoredShopeeToken(): Promise<StoredShopeeToken | null> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("marketplace_tokens")
    .select("*")
    .eq("platform", "shopee")
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler token da Shopee: ${error.message}`);
  return mapStoredShopeeToken(data);
}

/** Retorna true se o token expira dentro da margem (padrão 5 min). */
function isShopeeTokenExpiring(expiresAt: string, marginMs = 5 * 60 * 1000) {
  return new Date(expiresAt).getTime() <= Date.now() + marginMs;
}

export async function refreshShopeeAccessToken(refreshToken: string, shopId: number): Promise<ShopeeToken> {
  const { partnerId, partnerKey } = getShopeeConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const sign = signShopee(partnerId, SHOPEE_REFRESH_PATH, timestamp, partnerKey);
  const url = new URL(`${SHOPEE_API_BASE}${SHOPEE_REFRESH_PATH}`);
  url.searchParams.set("partner_id", String(partnerId));
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken, partner_id: partnerId, shop_id: shopId }),
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || data?.error || !data?.access_token) {
    throw new Error(data?.message ?? "Falha ao renovar token da Shopee.");
  }
  return data as ShopeeToken;
}

export async function getValidShopeeAccessToken(): Promise<{ accessToken: string; shopId: number }> {
  const stored = await getStoredShopeeToken();
  if (!stored) throw new Error("Shopee ainda não autorizada.");
  if (!isShopeeTokenExpiring(stored.expiresAt)) {
    return { accessToken: stored.accessToken, shopId: stored.shopId };
  }
  if (!stored.refreshToken) throw new Error("Refresh token da Shopee ausente.");
  // A Shopee rotaciona access_token E refresh_token a cada renovação: persistir os dois.
  const refreshed = await refreshShopeeAccessToken(stored.refreshToken, stored.shopId);
  await persistShopeeToken(refreshed, stored.shopId);
  return { accessToken: refreshed.access_token, shopId: stored.shopId };
}

export async function getShopeeShopInfo(accessToken: string, shopId: number) {
  const response = await fetch(buildGetShopInfoUrl(accessToken, shopId), {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.message ?? `Shopee respondeu HTTP ${response.status}.`);
  }
  return data as { shop_name?: string };
}

// Cache em memória da verificação para não chamar a Shopee a cada request.
const VERIFICATION_CACHE_TTL_MS = 5 * 60 * 1000;
let verificationCache: { checkedAt: number; connected: boolean } | null = null;

/**
 * true somente quando uma chamada real à API da Shopee com o token
 * persistido responde OK. Nunca lança: erro vira false (not_tested).
 */
export async function verifyShopeeConnection(nowMs = Date.now()): Promise<boolean> {
  if (verificationCache && nowMs - verificationCache.checkedAt < VERIFICATION_CACHE_TTL_MS) {
    return verificationCache.connected;
  }
  let connected = false;
  try {
    const { accessToken, shopId } = await getValidShopeeAccessToken();
    const info = await getShopeeShopInfo(accessToken, shopId);
    connected = typeof info?.shop_name === "string" && info.shop_name.length > 0;
  } catch {
    connected = false;
  }
  verificationCache = { checkedAt: nowMs, connected };
  return connected;
}
