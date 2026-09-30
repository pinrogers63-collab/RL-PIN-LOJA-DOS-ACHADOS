const ML_AUTH_BASE = "https://auth.mercadolivre.com.br/authorization";
const ML_TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const ML_API_BASE = "https://api.mercadolibre.com";

export function getMercadoLivreConfig() {
  const clientId = process.env.MERCADOLIVRE_CLIENT_ID;
  const clientSecret = process.env.MERCADOLIVRE_CLIENT_SECRET;
  const redirectUri = process.env.MERCADOLIVRE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Credenciais do Mercado Livre ainda não configuradas.");
  }

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

export async function exchangeMercadoLivreCode(code: string) {
  const { clientId, clientSecret, redirectUri } = getMercadoLivreConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri
  });

  const response = await fetch(ML_TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message ?? "Falha ao trocar code por token do Mercado Livre.");
  }

  return data as {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope?: string;
    user_id: number;
    refresh_token?: string;
  };
}

export async function mercadoLivreGet<T>(path: string, accessToken: string): Promise<T> {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${ML_API_BASE}${safePath}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      accept: "application/json"
    },
    cache: "no-store"
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message ?? `Mercado Livre respondeu HTTP ${response.status}.`);
  }
  return data as T;
}
