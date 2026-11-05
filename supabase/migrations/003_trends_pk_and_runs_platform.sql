-- =====================================================================
-- RL PIN — Loja dos Achados · Migration 003: destrave da escrita dos coletores
-- Data: 2026-11-05
-- Contexto: aplicada ao vivo no SQL Editor em 2026-11-05; este arquivo é o
-- registro fiel da correção no repositório. Idempotente.
--
-- CAUSA RAIZ do "nenhum produto flui desde 19/10/2026":
-- os crons disparavam e a rota respondia 200, mas os inserts dos coletores
-- eram rejeitados em silêncio por duas colunas legadas NOT NULL que os
-- coletores nunca enviam:
--   1) marketplace_trend_runs.platform — legado; os coletores gravam
--      run_type/status/fetched/stored/error, sem platform.
--   2) marketplace_trends.keyword_key — fazia parte da PK legada
--      (platform, keyword_key), desenho de "uma linha por palavra-chave",
--      incompatível com a coleta de listagens (dezenas de linhas por
--      palavra-chave, histórico por captura). NÃO dá pra soltar NOT NULL
--      de coluna de PK (erro 42P16): a correção troca a identidade da
--      tabela para `id` (o desenho da migration 001).
-- Nenhum dado é apagado: as linhas legadas são preservadas.
-- =====================================================================

-- 1) marketplace_trend_runs — platform deixa de ser obrigatória.
ALTER TABLE public.marketplace_trend_runs
  ALTER COLUMN platform DROP NOT NULL;

-- 2) marketplace_trends — remove a PK legada (platform, keyword_key),
--    somente se ela ainda for a PK vigente.
DO $$
DECLARE c text;
BEGIN
  SELECT con.conname INTO c
  FROM pg_constraint con
  WHERE con.conrelid = 'public.marketplace_trends'::regclass
    AND con.contype = 'p'
    AND (
      SELECT string_agg(a.attname, ',' ORDER BY k.ord)
      FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a
        ON a.attrelid = con.conrelid AND a.attnum = k.attnum
    ) = 'platform,keyword_key';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.marketplace_trends DROP CONSTRAINT %I', c);
  END IF;
END $$;

-- 3) marketplace_trends — id vira a identidade da tabela (padrão da 001).
ALTER TABLE public.marketplace_trends
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.marketplace_trends
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.marketplace_trends
  ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.marketplace_trends'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.marketplace_trends ADD PRIMARY KEY (id);
  END IF;
END $$;

-- 4) keyword_key vira coluna comum (legado preservado, sem obrigatoriedade).
ALTER TABLE public.marketplace_trends
  ALTER COLUMN keyword_key DROP NOT NULL;
