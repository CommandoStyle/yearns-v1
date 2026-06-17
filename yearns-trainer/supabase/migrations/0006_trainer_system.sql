-- Yearns — Migration 0006: User roles + trainer_reviews table
-- Adds role-based access control and the complete trainer review schema.
--
-- New role values: 'user' (default) | 'trainer' | 'admin'
-- Trainer accounts are seeded manually — no self-service role elevation.
-- All trainer routes check role = 'trainer' OR 'admin' via middleware.

-- ─── Add role to users ────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'trainer', 'admin'));

CREATE INDEX idx_users_role ON public.users(role);

COMMENT ON COLUMN public.users.role IS
  'user = standard subscriber, trainer = quality reviewer, admin = full access';

-- ─── trainer_reviews ──────────────────────────────────────────────────────────
-- One row per trainer per story. A story can have multiple reviews
-- from different trainers (useful for inter-rater reliability tracking).
-- Stores everything needed to feed both the prompt iteration pipeline
-- and the fine-tuning corpus builder.

CREATE TABLE public.trainer_reviews (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Story being reviewed
  -- References generation_logs.id — every generated story has a log entry.
  story_id        UUID        NOT NULL REFERENCES public.generation_logs(id) ON DELETE CASCADE,

  -- Trainer who submitted this review
  trainer_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Uniqueness: one review per trainer per story.
  -- A trainer can update their review (upsert) but not create duplicates.
  UNIQUE (story_id, trainer_id),

  -- ── Dimension scores (8 dimensions, 1–5 each) ──────────────────────────────
  -- Stored as JSONB for flexibility as dimensions evolve.
  -- Schema: {
  --   "arousal_curve": 4,
  --   "female_desire": 3,
  --   "character_depth": 4,
  --   "prose_quality": 3,
  --   "sensory_detail": 4,
  --   "profile_fidelity": 5,
  --   "pacing": 3
  -- }
  scores          JSONB       NOT NULL DEFAULT '{}',

  -- Computed average of all dimension scores (materialised for fast queries)
  avg_score       NUMERIC(3,2)
                              GENERATED ALWAYS AS (
                                (
                                  COALESCE((scores->>'arousal_curve')::numeric, 0) +
                                  COALESCE((scores->>'female_desire')::numeric, 0) +
                                  COALESCE((scores->>'character_depth')::numeric, 0) +
                                  COALESCE((scores->>'prose_quality')::numeric, 0) +
                                  COALESCE((scores->>'sensory_detail')::numeric, 0) +
                                  COALESCE((scores->>'profile_fidelity')::numeric, 0) +
                                  COALESCE((scores->>'pacing')::numeric, 0)
                                ) / NULLIF(
                                  (CASE WHEN scores ? 'arousal_curve' THEN 1 ELSE 0 END +
                                   CASE WHEN scores ? 'female_desire' THEN 1 ELSE 0 END +
                                   CASE WHEN scores ? 'character_depth' THEN 1 ELSE 0 END +
                                   CASE WHEN scores ? 'prose_quality' THEN 1 ELSE 0 END +
                                   CASE WHEN scores ? 'sensory_detail' THEN 1 ELSE 0 END +
                                   CASE WHEN scores ? 'profile_fidelity' THEN 1 ELSE 0 END +
                                   CASE WHEN scores ? 'pacing' THEN 1 ELSE 0 END),
                                0)
                              ) STORED,

  -- Binary gut-check — overrides a borderline avg_score
  reread          BOOLEAN     NOT NULL DEFAULT false,

  -- ── Failure codes (from taxonomy) ─────────────────────────────────────────
  -- Values: 'perspective_drift' | 'cliche_vocab' | 'emotional_flatness' |
  --         'rushed_to_explicit' | 'generic_character' | 'repetition' |
  --         'meta_commentary' | 'rhythm_flat' | 'abrupt_ending'
  failure_codes   TEXT[]      DEFAULT '{}',

  -- ── Corpus decision ────────────────────────────────────────────────────────
  -- 'gold'    = include in fine-tuning training data (avg >= 4.0 AND reread = true)
  -- 'discard' = do not use anywhere
  -- 'regen'   = good profile config, failed generation — regenerate with next prompt version
  -- null      = not yet decided (trainer skipped this field)
  corpus_tag      TEXT        CHECK (corpus_tag IN ('gold', 'discard', 'regen')),

  -- ── Text annotations ───────────────────────────────────────────────────────
  -- Array of annotation objects attached to spans of the story text.
  -- Schema per element: {
  --   "type": "gold" | "flag" | "comment",
  --   "start": 142,          -- character offset in story text
  --   "end": 198,            -- character offset
  --   "text": "the selected text",
  --   "comment": "optional free text note",
  --   "failure_code": "cliche_vocab"  -- for flag type only
  -- }
  annotations     JSONB       NOT NULL DEFAULT '[]',

  -- ── Free text notes ────────────────────────────────────────────────────────
  notes           TEXT,       -- overall session notes, max 2000 chars in UI

  -- ── Context snapshot (denormalised for query convenience) ─────────────────
  -- Copied from generation_logs at review time so we can filter/aggregate
  -- without joining back to generation_logs on every query.
  prompt_version  TEXT,
  model_used      TEXT,       -- 'CLAUDE' | 'LLAMA_70B' | 'MIXTRAL'
  explicitness    SMALLINT    CHECK (explicitness BETWEEN 1 AND 4),
  language        TEXT,

  -- ── Timestamps ────────────────────────────────────────────────────────────
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trainer_reviews_updated_at
  BEFORE UPDATE ON public.trainer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for the most common query patterns
CREATE INDEX idx_reviews_story_id    ON public.trainer_reviews(story_id);
CREATE INDEX idx_reviews_trainer_id  ON public.trainer_reviews(trainer_id);
CREATE INDEX idx_reviews_corpus_tag  ON public.trainer_reviews(corpus_tag) WHERE corpus_tag IS NOT NULL;
CREATE INDEX idx_reviews_avg_score   ON public.trainer_reviews(avg_score DESC);
CREATE INDEX idx_reviews_prompt_ver  ON public.trainer_reviews(prompt_version);
CREATE INDEX idx_reviews_model       ON public.trainer_reviews(model_used);
CREATE INDEX idx_reviews_submitted   ON public.trainer_reviews(submitted_at DESC);

-- ─── story_queue ──────────────────────────────────────────────────────────────
-- Controls which stories are assigned to which trainers.
-- Populated by an admin or a scheduled job that pulls from generation_logs.
-- Prevents the same story being reviewed by the same trainer twice,
-- and supports blind review (trainer doesn't know which prompt version
-- a story was generated with until after submission).

CREATE TABLE public.story_queue (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  story_id        UUID        NOT NULL REFERENCES public.generation_logs(id) ON DELETE CASCADE,
  trainer_id      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  -- null = unassigned (available to any trainer)

  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'in_progress', 'reviewed', 'skipped')),

  -- Blind review support: hide prompt_version and model_used from trainer
  -- until after they submit. The trainer sees the story text only.
  blind_review    BOOLEAN     NOT NULL DEFAULT true,

  -- Priority: higher = shown first in trainer queue
  priority        SMALLINT    NOT NULL DEFAULT 0,

  assigned_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_queue_trainer_status ON public.story_queue(trainer_id, status);
CREATE INDEX idx_queue_pending        ON public.story_queue(status, priority DESC)
  WHERE status = 'pending';

-- ─── RLS for new tables ───────────────────────────────────────────────────────

ALTER TABLE public.trainer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_queue     ENABLE ROW LEVEL SECURITY;

-- Trainers can read and write their own reviews only
CREATE POLICY "trainer_reviews: own rows"
  ON public.trainer_reviews
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- Admins can read all reviews (for aggregate analytics)
-- Applied via service role in API routes — not via RLS policy
-- (service role bypasses RLS; admin-scoped reads happen server-side only)

-- Story queue: trainers can read their assigned items + unassigned items
CREATE POLICY "story_queue: trainer read"
  ON public.story_queue FOR SELECT
  USING (
    trainer_id = auth.uid()
    OR trainer_id IS NULL  -- unassigned items visible to all trainers
  );

-- Trainers can update status on their assigned items only
CREATE POLICY "story_queue: trainer update"
  ON public.story_queue FOR UPDATE
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

-- ─── Helper function: get_trainer_queue ───────────────────────────────────────
-- Returns the next N stories for a trainer to review.
-- Prioritises: assigned to them > unassigned > highest priority > oldest.
-- Excludes stories they've already reviewed.

CREATE OR REPLACE FUNCTION public.get_trainer_queue(
  p_trainer_id  UUID,
  p_limit       INTEGER DEFAULT 20
)
RETURNS TABLE (
  queue_id      UUID,
  story_id      UUID,
  blind_review  BOOLEAN,
  priority      SMALLINT,
  -- Story context (from generation_logs)
  story_text    TEXT,    -- NOTE: generation_logs doesn't store story text.
                         -- story_text is fetched from Supabase Storage by the app.
                         -- This column is a placeholder; app layer handles retrieval.
  explicitness  SMALLINT,
  language      TEXT,
  length_mins   SMALLINT,
  prompt_version TEXT,
  model_used    TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    q.id            AS queue_id,
    q.story_id,
    q.blind_review,
    q.priority,
    NULL::TEXT      AS story_text,
    g.explicitness,
    g.language,
    g.length_mins,
    CASE WHEN q.blind_review THEN NULL ELSE g.prompt_version END AS prompt_version,
    CASE WHEN q.blind_review THEN NULL ELSE g.model_used END     AS model_used,
    g.created_at
  FROM public.story_queue q
  JOIN public.generation_logs g ON g.id = q.story_id
  WHERE q.status = 'pending'
    AND (q.trainer_id = p_trainer_id OR q.trainer_id IS NULL)
    AND q.story_id NOT IN (
      SELECT story_id FROM public.trainer_reviews WHERE trainer_id = p_trainer_id
    )
  ORDER BY
    (q.trainer_id = p_trainer_id) DESC,  -- assigned first
    q.priority DESC,
    q.created_at ASC
  LIMIT p_limit;
$$;

-- ─── Helper function: get_review_stats ────────────────────────────────────────
-- Aggregate stats for the trainer dashboard header and admin analytics.

CREATE OR REPLACE FUNCTION public.get_review_stats(
  p_prompt_version  TEXT DEFAULT NULL,
  p_model_used      TEXT DEFAULT NULL,
  p_language        TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_reviews     BIGINT,
  avg_score         NUMERIC,
  gold_count        BIGINT,
  discard_count     BIGINT,
  regen_count       BIGINT,
  reread_rate       NUMERIC,
  top_failure_code  TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH filtered AS (
    SELECT *
    FROM public.trainer_reviews
    WHERE (p_prompt_version IS NULL OR prompt_version = p_prompt_version)
      AND (p_model_used     IS NULL OR model_used     = p_model_used)
      AND (p_language       IS NULL OR language       = p_language)
  ),
  failure_counts AS (
    SELECT unnest(failure_codes) AS code, COUNT(*) AS cnt
    FROM filtered
    GROUP BY code
    ORDER BY cnt DESC
    LIMIT 1
  )
  SELECT
    COUNT(*)                                            AS total_reviews,
    ROUND(AVG(f.avg_score), 2)                         AS avg_score,
    COUNT(*) FILTER (WHERE corpus_tag = 'gold')        AS gold_count,
    COUNT(*) FILTER (WHERE corpus_tag = 'discard')     AS discard_count,
    COUNT(*) FILTER (WHERE corpus_tag = 'regen')       AS regen_count,
    ROUND(AVG(reread::int::numeric) * 100, 1)          AS reread_rate,
    (SELECT code FROM failure_counts LIMIT 1)          AS top_failure_code
  FROM filtered f;
$$;

-- ─── Seed: promote trainer accounts ──────────────────────────────────────────
-- Run after dev_seed.sql to give the test trainer account the right role.
-- Replace with real trainer email addresses for production.

UPDATE public.users
SET role = 'trainer'
WHERE email IN (
  'trainer@yearns.test'
  -- add real trainer emails here before running on production
);

-- If the trainer test user doesn't exist yet, create them:
-- (Supabase auth.users insert triggers the public.users row creation)
-- Create via Supabase dashboard → Authentication → Users → Add user
-- Then run: UPDATE public.users SET role = 'trainer' WHERE email = 'trainer@yearns.test';
