import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildTokenRow,
  mapStoredToken,
  isTokenExpiring,
  getMercadoLivreConfig
} from "../lib/mercadolivre";

const SAMPLE_TOKEN = {
  access_token: "APP_USR-123",
  token_type: "Bearer",
  expires_in: 21600,
  scope: "read write",
  user_id: 123456,
  refresh_token: "REF-456"
};

describe("buildTokenRow", () => {
  it("monta a linha com platform mercado_livre e expiração futura", () => {
    const before = Date.now();
    const row = buildTokenRow(SAMPLE_TOKEN);
    expect(row.platform).toBe("mercado_livre");
    expect(row.external_user_id).toBe("123456");
    expect(row.access_token).toBe("APP_USR-123");
    expect(row.refresh_token).toBe("REF-456");
    const expiresAt = new Date(row.expires_at).getTime();
    expect(expiresAt).toBeGreaterThan(before + 21500 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 21700 * 1000);
  });

  it("aceita token sem refresh_token nem scope", () => {
    const row = buildTokenRow({ ...SAMPLE_TOKEN, refresh_token: undefined, scope: undefined });
    expect(row.refresh_token).toBeNull();
    expect(row.scope).toBeNull();
    expect(row.token_type).toBe("Bearer");
  });
});

describe("mapStoredToken", () => {
  it("mapeia a linha do banco para o formato interno", () => {
    const row = {
      platform: "mercado_livre",
      external_user_id: "123456",
      access_token: "APP_USR-123",
      refresh_token: "REF-456",
      token_type: "Bearer",
      scope: "read",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      updated_at: new Date().toISOString()
    };
    const token = mapStoredToken(row);
    expect(token).toMatchObject({
      platform: "mercado_livre",
      access_token: "APP_USR-123",
      refresh_token: "REF-456"
    });
  });

  it("retorna null quando não há linha", () => {
    expect(mapStoredToken(null)).toBeNull();
  });
});

describe("isTokenExpiring", () => {
  it("detecta token já expirado", () => {
    expect(isTokenExpiring(new Date(Date.now() - 1000).toISOString())).toBe(true);
  });

  it("detecta token expirando dentro da margem de 5 minutos", () => {
    expect(isTokenExpiring(new Date(Date.now() + 4 * 60_000).toISOString())).toBe(true);
  });

  it("não marca token válido como expirando", () => {
    expect(isTokenExpiring(new Date(Date.now() + 60 * 60_000).toISOString())).toBe(false);
  });
});

describe("getMercadoLivreConfig sem credenciais", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.MERCADOLIVRE_CLIENT_ID;
    delete process.env.MERCADOLIVRE_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("lança erro claro quando as credenciais estão ausentes", () => {
    expect(() => getMercadoLivreConfig()).toThrow(/credenciais/i);
  });
});
