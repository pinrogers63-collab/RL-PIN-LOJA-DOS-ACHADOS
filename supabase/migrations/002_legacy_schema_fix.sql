-- =====================================================================
-- RL PIN — Loja dos Achados · Migration 002: alinhamento do schema legado
-- Data: 2026-10-20
-- Contexto: o banco Supabase RL-PIN-LOJA-DOS-ACHADOS já continha o schema
-- legado completo (16 tabelas usadas pelo código). A migration 001 falhou
-- neste banco porque a tabela legada `marketplace_trends` não possui as
-- colunas que os coletores atuais gravam. Esta migration adiciona SOMENTE
-- o que falta. Idempotente: pode rodar mais de uma vez sem erro.
-- Não cria nem apaga tabelas; não altera dados existentes.
-- =====================================================================

-- 1) marketplace_trends — colunas de ESCRITA dos coletores
--    (lib/marketplace-trends-collector.ts e lib/ml-public-collect.ts).
--    A tabela legada só tinha as colunas de leitura da tela de operações
--    (keyword_key, source_url, first_seen_at, last_seen_at, observations).
ALTER TABLE public.marketplace_trends
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS listing_id text,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS run_type text,
  ADD COLUMN IF NOT EXISTS captured_at timestamptz;

-- 2) marketplace_trend_runs — os coletores gravam fetched/stored;
--    a tabela legada só tinha items_found (usado pela tela de operações).
ALTER TABLE public.marketplace_trend_runs
  ADD COLUMN IF NOT EXISTS fetched integer,
  ADD COLUMN IF NOT EXISTS stored integer;

-- 3) Índices únicos exigidos pelos upserts do código:
--    - marketplace_tokens: upsert onConflict "platform" (tokens OAuth do ML)
--    - daily_snapshots:    upsert onConflict "owner_id,snapshot_date"
--    - publish_queue:      upsert onConflict "product_id,platform"
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_tokens_platform
  ON public.marketplace_tokens (platform);

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_snapshots_owner_date
  ON public.daily_snapshots (owner_id, snapshot_date);

CREATE UNIQUE INDEX IF NOT EXISTS uq_publish_queue_product_platform
  ON public.publish_queue (product_id, platform);

-- 4) Índice de leitura do histórico de tendências por data de captura.
CREATE INDEX IF NOT EXISTS idx_marketplace_trends_captured
  ON public.marketplace_trends (captured_at DESC);
