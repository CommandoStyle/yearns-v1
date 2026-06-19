-- Migration 0008: add per_story_overrides JSONB to generation_logs
--
-- Captures which per-story panel fields were used for analytics.
-- Stores presence flags only — free-text content is never logged.
-- Schema: {
--   "spark": true,
--   "character_override": true,
--   "pace": 3,
--   "specific_detail": true,
--   "tonights_want": true,
--   "participant_override": "voyeur"
-- }

ALTER TABLE public.generation_logs
  ADD COLUMN IF NOT EXISTS per_story_overrides JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.generation_logs.per_story_overrides IS
  'Which per-story panel fields were used. Boolean flags for presence (privacy-safe); pace stored as value 1-3; free text content is never stored here.';
