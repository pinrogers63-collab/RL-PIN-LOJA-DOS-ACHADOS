-- RL PIN — Loja dos Achados
-- Migration 001: esquema inicial (idempotente)
-- Tabelas usadas pelo código em lib/* e app/*.
-- Execute no SQL Editor do Supabase (ou via supabase db push).
-- RLS habilitado em todas as tabelas: leitura/escrita para usuários autenticados.
-- A service_role (server-side) ignora RLS automaticamente.

-- ============================================================
-- 1. products — catálogo de produtos garimpados
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  external_id TEXT,
  sku TEXT,
  source_url TEXT,
  title TEXT NOT NULL,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  market_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(6,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NOVO',
  supplier_id UUID,
  fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_score ON products(score DESC);

-- ============================================================
-- 2. app_settings — configurações centrais (linha única)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_product_score INTEGER NOT NULL DEFAULT 75,
  target_margin_percentage NUMERIC(6,2) NOT NULL DEFAULT 30,
  min_supplier_tests INTEGER NOT NULL DEFAULT 3,
  max_dispatch_hours INTEGER NOT NULL DEFAULT 48,
  max_policy_risk INTEGER NOT NULL DEFAULT 59,
  auto_homologate_supplier BOOLEAN NOT NULL DEFAULT true,
  default_currency TEXT NOT NULL DEFAULT 'BRL',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  daily_report_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. product_history — histórico de preço/estoque/score/status
-- ============================================================
CREATE TABLE IF NOT EXISTS product_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  market_price NUMERIC(12,2),
  cost NUMERIC(12,2),
  stock INTEGER,
  score NUMERIC(6,2),
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_history_product ON product_history(product_id, captured_at DESC);

-- ============================================================
-- 4. suppliers — fornecedores e homologação
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'EM_TESTE',
  channels TEXT[] NOT NULL DEFAULT '{}',
  ships_directly BOOLEAN NOT NULL DEFAULT false,
  invoice BOOLEAN NOT NULL DEFAULT false,
  invoice_mode TEXT NOT NULL DEFAULT 'A_VALIDAR',
  blind_shipping BOOLEAN NOT NULL DEFAULT false,
  delivery_days INTEGER,
  returns_supported BOOLEAN NOT NULL DEFAULT false,
  source_url TEXT,
  monthly_fee NUMERIC(12,2),
  setup_fee NUMERIC(12,2),
  api_fee NUMERIC(12,2),
  per_order_fee NUMERIC(12,2),
  minimum_balance NUMERIC(12,2),
  lockin_months INTEGER,
  cancellation_terms TEXT,
  evidence_url TEXT,
  api_access_verified BOOLEAN NOT NULL DEFAULT false,
  tracking BOOLEAN NOT NULL DEFAULT false,
  dispatch_hours INTEGER,
  stock_sync BOOLEAN NOT NULL DEFAULT false,
  tested_orders INTEGER NOT NULL DEFAULT 0,
  passed_tests INTEGER NOT NULL DEFAULT 0,
  failed_tests INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);

-- ============================================================
-- 5. supplier_research — radar de pesquisa de fornecedores
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  modality TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  public_price TEXT NOT NULL DEFAULT '',
  invoice_notes TEXT NOT NULL DEFAULT '',
  api_notes TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '',
  risks TEXT NOT NULL DEFAULT '',
  evidence_url TEXT NOT NULL DEFAULT '',
  researched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. fee_profiles — perfis de taxas por marketplace
-- ============================================================
CREATE TABLE IF NOT EXISTS fee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  percentage_fee NUMERIC(6,3) NOT NULL DEFAULT 0,
  fixed_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_estimate NUMERIC(12,2) NOT NULL DEFAULT 0,
  reserve_percentage NUMERIC(6,3) NOT NULL DEFAULT 0,
  ads_percentage NUMERIC(6,3) NOT NULL DEFAULT 0,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fee_profiles_platform ON fee_profiles(platform);

-- ============================================================
-- 7. salon_jobs — trabalhos do Salão (conceitos + Vitória)
-- ============================================================
CREATE TABLE IF NOT EXISTS salon_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'geral',
  selected_concept TEXT,
  victory_wardrobe JSONB NOT NULL DEFAULT '{}',
  channels TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'PLANEJADO',
  outputs JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_salon_jobs_product ON salon_jobs(product_id);

-- ============================================================
-- 8. publish_queue — fila segura de publicação
-- ============================================================
CREATE TABLE IF NOT EXISTS publish_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VALIDANDO',
  guard_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_publish_queue_product_platform UNIQUE (product_id, platform)
);

-- ============================================================
-- 9. audit_events — trilha de auditoria
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);

-- ============================================================
-- 10. connector_runs — execuções de conectores/crons
-- ============================================================
CREATE TABLE IF NOT EXISTS connector_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id TEXT NOT NULL,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_connector_runs_created ON connector_runs(created_at DESC);

-- ============================================================
-- 11. connectors — estado dos conectores
-- ============================================================
CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  connected BOOLEAN NOT NULL DEFAULT false,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 12. custom_integrations — integrações personalizadas
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANEJADO',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_custom_integrations_slug UNIQUE (slug)
);

-- ============================================================
-- 13. daily_snapshots — snapshots diários do painel
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL DEFAULT 'default',
  snapshot_date DATE NOT NULL,
  total_products INTEGER NOT NULL DEFAULT 0,
  valid_products INTEGER NOT NULL DEFAULT 0,
  salon_products INTEGER NOT NULL DEFAULT 0,
  published_products INTEGER NOT NULL DEFAULT 0,
  discarded_products INTEGER NOT NULL DEFAULT 0,
  supplier_count INTEGER NOT NULL DEFAULT 0,
  homologated_suppliers INTEGER NOT NULL DEFAULT 0,
  blocked_publish_items INTEGER NOT NULL DEFAULT 0,
  ready_publish_items INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_daily_snapshots_owner_date UNIQUE (owner_id, snapshot_date)
);

-- ============================================================
-- 14. marketplace_trends — tendências/coletas de marketplace
--    (tendências de busca oficiais + coleta pública de anúncios)
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL DEFAULT 'mercado_livre',
  keyword TEXT NOT NULL,
  url TEXT,
  title TEXT,
  price NUMERIC(12,2),
  listing_id TEXT,
  kind TEXT NOT NULL DEFAULT 'listing',
  run_type TEXT NOT NULL DEFAULT 'COLLECT',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_marketplace_trends UNIQUE (platform, keyword, listing_id, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_marketplace_trends_keyword ON marketplace_trends(keyword, captured_at DESC);

-- ============================================================
-- 15. marketplace_trend_runs — execuções das coletas
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_trend_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  fetched INTEGER NOT NULL DEFAULT 0,
  stored INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_trend_runs_created ON marketplace_trend_runs(created_at DESC);

-- ============================================================
-- 16. marketplace_tokens — tokens OAuth persistidos (server-side)
--    Substitui as Edge Functions marketplace-token-store /
--    marketplace-trend-store. Escrita SOMENTE via service role.
-- ============================================================
CREATE TABLE IF NOT EXISTS marketplace_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  external_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_marketplace_tokens_platform UNIQUE (platform)
);

-- ============================================================
-- RLS: habilita em todas as tabelas e libera acesso total
-- para usuários autenticados. A service_role ignora RLS.
-- ============================================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','app_settings','product_history','suppliers','supplier_research',
    'fee_profiles','salon_jobs','publish_queue','audit_events','connector_runs',
    'connectors','custom_integrations','daily_snapshots','marketplace_trends',
    'marketplace_trend_runs','marketplace_tokens'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = 'authenticated_full_access') THEN
      EXECUTE format('CREATE POLICY authenticated_full_access ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END
$$;

-- Comentários de documentação
COMMENT ON TABLE marketplace_tokens IS 'Tokens OAuth de marketplaces. Escrita exclusiva via service_role (server-side); nunca expor ao client.';
COMMENT ON TABLE marketplace_trends IS 'kind=trend: tendência de busca oficial; kind=listing: anúncio coletado via API pública (sem OAuth).';
