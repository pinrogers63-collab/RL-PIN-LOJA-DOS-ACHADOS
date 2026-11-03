import { createHmac } from "crypto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildGetShopInfoUrl,
  buildShopAuthUrl,
  buildShopeeTokenRow,
  getShopeeConfig,
  mapStoredShopeeToken,
  signShopee,
  signShopeeShopRequest
} from "../lib/shopee";

const PARTNER_ID = 1234567;
const PARTNER_KEY = "test-partner-key";
const FIXED_TIMESTAMP = 1700000000;

function expectedSign(path: string, timestamp: number) {
  return createHmac("sha256", PARTNER_KEY)
    .update(`${PARTNER_ID}${path}${timestamp}`)
    .digest("hex");
}

describe("signShopee", () => {
  it("calcula o HMAC-SHA256 de partner_id + path + timestamp em hex minúsculo", () => {
    const sign = signShopee(PARTNER_ID, "/api/v2/shop/auth_partner", FIXED_TIMESTAMP, PARTNER_KEY);
    expect(sign).toBe(expectedSign("/api/v2/shop/auth_partner", FIXED_TIMESTAMP));
    expect(sign).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gera assinaturas diferentes para paths diferentes", () => {
    const authSign = signShopee(PARTNER_ID, "/api/v2/shop/auth_partner", FIXED_TIMESTAMP, PARTNER_KEY);
    const tokenSign = signShopee(PARTNER_ID, "/api/v2/auth/token/get", FIXED_TIMESTAMP, PARTNER_KEY);
    expect(authSign).not.toBe(tokenSign);
    expect(tokenSign).toBe(expectedSign("/api/v2/auth/token/get", FIXED_TIMESTAMP));
  });
});

describe("buildShopAuthUrl e getShopeeConfig", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.SHOPEE_PARTNER_ID;
    delete process.env.SHOPEE_PARTNER_KEY;
    delete process.env.SHOPEE_REDIRECT_URI;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("lança erro claro quando as credenciais estão ausentes", () => {
    expect(() => getShopeeConfig()).toThrow(/credenciais/i);
    expect(() => buildShopAuthUrl(FIXED_TIMESTAMP)).toThrow(/credenciais/i);
  });

  it("lança erro claro quando o partner_id não é um número válido", () => {
    process.env.SHOPEE_PARTNER_ID = "abc";
    process.env.SHOPEE_PARTNER_KEY = PARTNER_KEY;
    expect(() => getShopeeConfig()).toThrow(/credenciais/i);
  });

  it("monta a URL de autorização assinada para o callback da Shopee", () => {
    process.env.SHOPEE_PARTNER_ID = String(PARTNER_ID);
    process.env.SHOPEE_PARTNER_KEY = PARTNER_KEY;
    const url = new URL(buildShopAuthUrl(FIXED_TIMESTAMP));
    expect(url.origin).toBe("https://partner.shopeemobile.com");
    expect(url.pathname).toBe("/api/v2/shop/auth_partner");
    expect(url.searchParams.get("partner_id")).toBe(String(PARTNER_ID));
    expect(url.searchParams.get("timestamp")).toBe(String(FIXED_TIMESTAMP));
    expect(url.searchParams.get("sign")).toBe(expectedSign("/api/v2/shop/auth_partner", FIXED_TIMESTAMP));
    expect(url.searchParams.get("redirect")).toBe(
      "https://rl-pin-loja-dos-achados.vercel.app/api/integrations/shopee/callback"
    );
  });
});

describe("signShopeeShopRequest e buildGetShopInfoUrl", () => {
  const OLD_ENV = { ...process.env };
  const ACCESS_TOKEN = "ACC-TOKEN-XYZ";
  const SHOP_ID = 1121615229;

  beforeEach(() => {
    process.env.SHOPEE_PARTNER_ID = String(PARTNER_ID);
    process.env.SHOPEE_PARTNER_KEY = PARTNER_KEY;
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  function expectedShopSign(path: string, timestamp: number) {
    return createHmac("sha256", PARTNER_KEY)
      .update(`${PARTNER_ID}${path}${timestamp}${ACCESS_TOKEN}${SHOP_ID}`)
      .digest("hex");
  }

  it("assina com partner_id + path + timestamp + access_token + shop_id", () => {
    const sign = signShopeeShopRequest(
      PARTNER_ID,
      "/api/v2/shop/get_shop_info",
      FIXED_TIMESTAMP,
      ACCESS_TOKEN,
      SHOP_ID,
      PARTNER_KEY
    );
    expect(sign).toBe(expectedShopSign("/api/v2/shop/get_shop_info", FIXED_TIMESTAMP));
    expect(sign).toMatch(/^[0-9a-f]{64}$/);
    // A assinatura de loja difere da assinatura pública (sem token/shop).
    expect(sign).not.toBe(expectedSign("/api/v2/shop/get_shop_info", FIXED_TIMESTAMP));
  });

  it("monta a URL de get_shop_info com todos os parâmetros exigidos", () => {
    const url = new URL(buildGetShopInfoUrl(ACCESS_TOKEN, SHOP_ID, FIXED_TIMESTAMP));
    expect(url.origin).toBe("https://partner.shopeemobile.com");
    expect(url.pathname).toBe("/api/v2/shop/get_shop_info");
    expect(url.searchParams.get("partner_id")).toBe(String(PARTNER_ID));
    expect(url.searchParams.get("timestamp")).toBe(String(FIXED_TIMESTAMP));
    expect(url.searchParams.get("shop_id")).toBe(String(SHOP_ID));
    expect(url.searchParams.get("access_token")).toBe(ACCESS_TOKEN);
    expect(url.searchParams.get("sign")).toBe(expectedShopSign("/api/v2/shop/get_shop_info", FIXED_TIMESTAMP));
  });
});

describe("mapStoredShopeeToken", () => {
  it("mapeia a linha persistida para o formato interno", () => {
    const token = mapStoredShopeeToken({
      platform: "shopee",
      external_user_id: "1121615229",
      access_token: "ACC-123",
      refresh_token: "REF-456",
      token_type: "Bearer",
      scope: null,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      updated_at: new Date().toISOString()
    });
    expect(token).toEqual({
      shopId: 1121615229,
      accessToken: "ACC-123",
      refreshToken: "REF-456",
      expiresAt: expect.any(String)
    });
  });

  it("retorna null sem linha, sem access_token ou com shop inválido", () => {
    expect(mapStoredShopeeToken(null)).toBeNull();
    expect(mapStoredShopeeToken({ external_user_id: "1121615229" })).toBeNull();
    expect(mapStoredShopeeToken({ external_user_id: "abc", access_token: "ACC" })).toBeNull();
  });
});

describe("buildShopeeTokenRow", () => {
  it("monta a linha com platform shopee, shop em external_user_id e expiração futura", () => {
    const before = Date.now();
    const row = buildShopeeTokenRow(
      { access_token: "ACC-123", refresh_token: "REF-456", expire_in: 14400 },
      987654
    );
    expect(row.platform).toBe("shopee");
    expect(row.external_user_id).toBe("987654");
    expect(row.access_token).toBe("ACC-123");
    expect(row.refresh_token).toBe("REF-456");
    const expiresAt = new Date(row.expires_at).getTime();
    expect(expiresAt).toBeGreaterThan(before + 14300 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 14500 * 1000);
  });
});
