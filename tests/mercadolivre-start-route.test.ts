import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { GET } from "../app/api/integrations/mercadolivre/start/route";

describe("GET /api/integrations/mercadolivre/start", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.MERCADOLIVRE_CLIENT_ID;
    delete process.env.MERCADOLIVRE_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("retorna 503 com mensagem amigável em pt-BR quando as credenciais estão ausentes", async () => {
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/Mercado Livre ainda não configurada/i);
    expect(JSON.stringify(body)).not.toMatch(/stack|at .*\(/i);
  });

  it("redireciona (302) para o Mercado Livre quando as credenciais existem", async () => {
    process.env.MERCADOLIVRE_CLIENT_ID = "fake-id";
    process.env.MERCADOLIVRE_CLIENT_SECRET = "fake-secret";
    const response = await GET();
    expect(response.status).toBe(302);
    const location = response.headers.get("Location") ?? "";
    expect(location).toContain("auth.mercadolivre.com.br/authorization");
    expect(location).toContain("client_id=fake-id");
  });
});
