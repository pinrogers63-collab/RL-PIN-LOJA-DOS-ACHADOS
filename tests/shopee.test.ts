import { createHmac } from "crypto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildShopAuthUrl,
  buildShopeeTokenRow,
  getShopeeConfig,
  signShopee
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
