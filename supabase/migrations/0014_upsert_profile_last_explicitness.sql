-- Migration 0014: update upsert_desire_profile to accept last_explicitness_used
-- Also removes writes to deprecated columns (emotional_register, desire_targets,
-- setting_preference) — per migration 0013 these are no longer populated.
-- Existing rows retain their data; the columns are simply no longer written.

CREATE OR REPLACE FUNCTION public.upsert_desire_profile(
  p_user_id             uuid,
  p_display_name        text     DEFAULT NULL,
  p_language            text     DEFAULT NULL,
  p_three_words         text[]   DEFAULT NULL,
  p_hard_limits         text[]   DEFAULT NULL,
  p_participant_mode    text     DEFAULT NULL,
  p_age_band            text     DEFAULT NULL,
  p_prose_rhythm        text     DEFAULT NULL,
  p_last_explicitness   smallint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.desire_profiles (
    user_id,
    display_name,
    language,
    three_words,
    hard_limits,
    participant_mode,
    age_band,
    prose_rhythm,
    last_explicitness_used,
    onboarding_complete
  ) VALUES (
    p_user_id,
    p_display_name,
    p_language,
    p_three_words,
    p_hard_limits,
    p_participant_mode,
    p_age_band,
    p_prose_rhythm,
    COALESCE(p_last_explicitness, 2),
    false
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name           = COALESCE(EXCLUDED.display_name,           desire_profiles.display_name),
    language               = COALESCE(EXCLUDED.language,               desire_profiles.language),
    three_words            = COALESCE(EXCLUDED.three_words,            desire_profiles.three_words),
    hard_limits            = COALESCE(EXCLUDED.hard_limits,            desire_profiles.hard_limits),
    participant_mode       = COALESCE(EXCLUDED.participant_mode,       desire_profiles.participant_mode),
    age_band               = COALESCE(EXCLUDED.age_band,               desire_profiles.age_band),
    prose_rhythm           = COALESCE(EXCLUDED.prose_rhythm,           desire_profiles.prose_rhythm),
    last_explicitness_used = COALESCE(EXCLUDED.last_explicitness_used, desire_profiles.last_explicitness_used),
    updated_at             = now();
END;
$$;
