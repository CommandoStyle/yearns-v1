-- Yearns — Migration 0005: Add model_used to generation_logs + increment_session_count RPC
-- Required by the hybrid model router (Claude for levels 1-2, Together.ai for 3-4).
-- model_used is recorded per generation for trainer analytics and cost tracking.

-- ─── Add model_used to generation_logs ───────────────────────────────────────

ALTER TABLE public.generation_logs
  ADD COLUMN model_used TEXT;

-- Values: 'CLAUDE' | 'LLAMA_70B' | 'MIXTRAL'
-- NULL = legacy rows generated before this migration.
COMMENT ON COLUMN public.generation_logs.model_used IS
  'Model that generated this story: CLAUDE | LLAMA_70B | MIXTRAL. NULL = pre-v1.1 rows.';

CREATE INDEX idx_gen_logs_model ON public.generation_logs(model_used)
  WHERE model_used IS NOT NULL;

-- ─── increment_session_count RPC ─────────────────────────────────────────────
-- Called after each successful generation for Pro users.
-- Free users use increment_monthly_usage instead.
-- Tracks total lifetime generations per user (used for analytics + progressive unlock).

CREATE OR REPLACE FUNCTION public.increment_session_count(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
  SET session_count = COALESCE(session_count, 0) + 1
  WHERE id = p_user_id;
$$;
