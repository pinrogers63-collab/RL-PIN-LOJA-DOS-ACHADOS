const ML_AUTH_BASE = "https://auth.mercadolivre.com.br/authorization";
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const ML_API_BASE = "https://api.mercadolibre.com";
const DEFAULT_APP_URL = "https://rl-pin-loja-dos-achados-omini1.vercel.app";

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

function getTokenStoreConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.CRON_SECRET;
  if (!url || !secret) throw new Error("Token store não configurado.");
  return {
    endpoint: `${url.replace(/\\\/$/, "")}/functions/v1/marketplace-token-store`,
    secret
  };
}

async function tokenStore<T>(body: Record<string, unknown>): Promise<T> {
  const { endpoint, secret } = getTokenStoreConfig();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-rlpin-secret": secret
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Token store HTTP ${response.status}: ${text.slice(0, 160)}`);
  return (text ? JSON.parse(text) : null) as T;
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
  await tokenStore<{ ok: boolean }>({
    action: "save",
    platform: "mercado_livre",
    external_user_id: String(token.user_id),
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? null,
    token_type: token.token_type ?? "Bearer",
    scope: token.scope ?? null,
    expires_in: token.expires_in
  });
}

export async function getStoredMercadoLivreToken(): Promise<StoredMarketplaceToken | null> {
  const result = await tokenStore<{ ok: boolean; token: StoredMarketplaceToken | null }>({
    action: "get",
    platform: "mercado_livre"
  });
  return result.token ?? null;
}

export async function getValidMercadoLivreToken() {
  const stored = await getStoredMercadoLivreToken();
  if (!stored) throw new Error("Mercado Livre ainda não autorizado.");
  const expiresSoon = new Date(stored.expires_at).getTime() <= Date.now() + 5 * 60 * 1000;
  if (!expiresSoon) return stored.access_token;
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
