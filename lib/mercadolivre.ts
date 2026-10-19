import { getSupabaseServiceRole } from "./supabase-server";

const ML_AUTH_BASE = "https://auth.mercadolivre.com.br/authorization";
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const ML_API_BASE = "https://api.mercadolibre.com";
const DEFAULT_APP_URL = "https://rl-pin-loja-dos-achados.vercel.app";

type MercadoLivreToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id: number;
  refresh_token?: string;
};

type StoredMarketplaceToken = {
  platform: string;
  external_user_id: string | null;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: string;
  updated_at: string;
};

/**
 * Persistência de tokens via tabela marketplace_tokens (service role, server-side).
 * Substitui as Edge Functions marketplace-token-store (inexistentes no deploy).
 * A interface pública (persist/get/getValid) é mantida intacta.
 */

export function buildTokenRow(token: MercadoLivreToken) {
  return {
    platform: "mercado_livre",
    external_user_id: String(token.user_id),
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    token_type: token.token_type ?? "Bearer",
    scope: token.scope ?? null,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function mapStoredToken(row: Record<string, any> | null): StoredMarketplaceToken | null {
  if (!row) return null;
  return {
    platform: row.platform,
    external_user_id: row.external_user_id,
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_type: row.token_type,
    scope: row.scope,
    expires_at: row.expires_at,
    updated_at: row.updated_at
  };
}

/** Retorna true se o token expira dentro da margem (padrão 5 min). */
export function isTokenExpiring(expiresAt: string, marginMs = 5 * 60 * 1000, nowMs = Date.now()) {
  return new Date(expiresAt).getTime() <= nowMs + marginMs;
}

export function getMercadoLivrePublicConfig() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
  const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI || `${appUrl}/api/integrations/mercadolivre/callback`;
  return {
    appUrl,
    redirectUri,
    webhookUrl: `${appUrl}/api/integrations/mercadolivre/webhook`,
    clientIdConfigured: Boolean(process.env.MERCADOLIVRE_CLIENT_ID),
    clientSecretConfigured: Boolean(process.env.MERCADOLIVRE_CLIENT_SECRET)
  };
}

export function getMercadoLivreConfig() {
  const clientId = process.env.MERCADOLIVRE_CLIENT_ID;
  const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET;
  const { redirectUri } = getMercadoLivrePublicConfig();
  if (!clientId || !clientSecret) throw new Error("Credenciais do Mercado Livre ainda não configuradas.");
  return { clientId, clientSecret, redirectUri };
}

export function buildMercadoLivreAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = getMercadoLivreConfig();
  const url = new URL(ML_AUTH_BASE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestToken(body: URLSearchParams): Promise<MercadoLivreToken> {
  const response = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message ?? "Falha ao obter token do Mercado Livre.");
  return data as MercadoLivreToken;
}

export async function exchangeMercadoLivreCode(code: string) {
  const { clientId, clientSecret, redirectUri } = getMercadoLivreConfig();
  return requestToken(new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri
  }));
}

export async function refreshMercadoLivreToken(refreshToken: string) {
  const { clientId, clientSecret } = getMercadoLivreConfig();
  return requestToken(new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken
  }));
}

export async function persistMercadoLivreToken(token: MercadoLivreToken) {
  const supabase = getSupabaseServiceRole();
  const { error } = await supabase
    .from("marketplace_tokens")
    .upsert(buildTokenRow(token), { onConflict: "platform" });
  if (error) throw new Error(`Falha ao persistir token do Mercado Livre: ${error.message}`);
}

export async function getStoredMercadoLivreToken(): Promise<StoredMarketplaceToken | null> {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from("marketplace_tokens")
    .select("*")
    .eq("platform", "mercado_livre")
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler token do Mercado Livre: ${error.message}`);
  return mapStoredToken(data);
}

export async function getValidMercadoLivreToken() {
  const stored = await getStoredMercadoLivreToken();
  if (!stored) throw new Error("Mercado Livre ainda não autorizado.");
  if (!isTokenExpiring(stored.expires_at)) return stored.access_token;
  if (!stored.refresh_token) throw new Error("Refresh token do Mercado Livre ausente.");
  const refreshed = await refreshMercadoLivreToken(stored.refresh_token);
  await persistMercadoLivreToken(refreshed);
  return refreshed.access_token;
}

export async function mercadoLivreGet<T>(path: string, accessToken: string): Promise<T> {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${ML_API_BASE}${safePath}`, {
    headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store"
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.message ?? `Mercado Livre respondeu HTTP ${response.status}.`);
  return data as T;
}
