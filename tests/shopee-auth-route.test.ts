import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { GET } from "../app/api/integrations/shopee/auth/route";

describe("GET /api/integrations/shopee/auth", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.SHOPEE_PARTNER_ID;
    delete process.env.SHOPEE_PARTNER_KEY;
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("retorna 503 com mensagem amigável em pt-BR quando as credenciais estão ausentes", async () => {
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/Shopee ainda não configurada/i);
    expect(JSON.stringify(body)).not.toMatch(/stack|at .*\(/i);
  });

  it("redireciona (307) para a autorização da Shopee quando as credenciais existem", async () => {
    process.env.SHOPEE_PARTNER_ID = "1234567";
    process.env.SHOPEE_PARTNER_KEY = "fake-key";
    const response = await GET();
    expect(response.status).toBe(307);
    const location = response.headers.get("Location") ?? "";
    expect(location).toContain("partner.shopeemobile.com/api/v2/shop/auth_partner");
    expect(location).toContain("partner_id=1234567");
    expect(location).toContain("sign=");
  });
});
