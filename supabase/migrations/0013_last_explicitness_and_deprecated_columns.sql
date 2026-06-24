-- Migration 0013: add last_explicitness_used to desire_profiles
-- Also marks emotional_register, desire_targets, setting_preference as
-- deprecated — these were populated only by onboarding screens that have
-- been removed (Part 2 of prompt-12). Per-story fields are now the sole
-- source of truth for these concepts. Do not drop — preserve existing data.

ALTER TABLE public.desire_profiles
  ADD COLUMN IF NOT EXISTS last_explicitness_used smallint DEFAULT 2;

COMMENT ON COLUMN public.desire_profiles.last_explicitness_used
  IS 'Most recently used explicitness level (1–4). Used as default dial position on next visit.';

COMMENT ON COLUMN public.desire_profiles.emotional_register
  IS 'DEPRECATED (prompt-12): was populated by onboarding FeelStep, now removed. Do not write. Read path removed from buildPrompt().';

COMMENT ON COLUMN public.desire_profiles.desire_targets
  IS 'DEPRECATED (prompt-12): was populated by onboarding DesireStep, now removed. Do not write. Read path removed from buildPrompt() — per-story character roster is the sole source of truth.';

COMMENT ON COLUMN public.desire_profiles.setting_preference
  IS 'DEPRECATED (prompt-12): was populated by onboarding SettingStep, now removed. Do not write. Per-story location selection is the sole source of truth.';
