-- Yearns — Migration 0005: Add model_used to generation_logs
-- Tracks which model generated each story for quality analytics.
-- Required for A/B quality comparison between Claude and Together.ai models.
-- Values: 'CLAUDE' | 'LLAMA_70B' | 'MIXTRAL'

ALTER TABLE public.generation_logs
  ADD COLUMN model_used TEXT;

-- Index for filtering analytics by model
CREATE INDEX idx_gen_logs_model ON public.generation_logs(model_used);

-- Comment for future reference
COMMENT ON COLUMN public.generation_logs.model_used IS
  'Model key used for generation. CLAUDE = claude-sonnet-4 (levels 1-2), '
  'LLAMA_70B = Meta-Llama-3.1-70B-Instruct-Turbo (level 3), '
  'MIXTRAL = Mixtral-8x22B-Instruct-v0.1 (level 4). '
  'Null for records created before migration 0005.';
