-- Migration 0010: Originality safeguard infrastructure

-- Part 1: similarity_check audit column on trainer_reviews
-- Stores the n-gram check result for any gold-tagging attempt (flagged or not).
-- Schema: {"max_similarity": 0.28, "matched_story_id": "uuid-or-null",
--          "matched_passage": "text-or-null", "flagged": false, "checked_at": "timestamp"}

ALTER TABLE public.trainer_reviews
  ADD COLUMN IF NOT EXISTS similarity_check JSONB;

COMMENT ON COLUMN public.trainer_reviews.similarity_check IS
  'Result of the gold corpus n-gram similarity check, stored when corpus_tag is set to gold.';

-- Part 2: originality_flags — async external plagiarism check results
-- Populated when a user saves a Yearn and the check returns flagged=true.
-- Admin-only table; service role used for all writes.
-- No user-facing RLS policy (users should not know a flag exists).

CREATE TABLE IF NOT EXISTS public.originality_flags (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  yearn_id     UUID        REFERENCES public.yearns(id)           ON DELETE CASCADE,
  story_id     UUID        REFERENCES public.generation_logs(id)  ON DELETE SET NULL,
  result       JSONB       NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending_review'
                           CHECK (status IN ('pending_review', 'reviewed_ok', 'reviewed_concern')),
  reviewed_by  UUID        REFERENCES public.users(id),
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.originality_flags ENABLE ROW LEVEL SECURITY;
-- Intentionally NO user-facing policy. Service role bypasses RLS for admin writes.
-- Trainers and users cannot read or write this table via the anon/user JWT.

CREATE INDEX originality_flags_status_idx ON public.originality_flags (status, created_at DESC);
