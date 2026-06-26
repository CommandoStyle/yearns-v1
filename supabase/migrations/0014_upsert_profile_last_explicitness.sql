-- Migration 0014 (corrected): add p_last_explicitness to upsert_desire_profile.
-- Extends the existing function with the new param — all old params retained with
-- NULL defaults so any existing callers continue to work. Deprecated params
-- (p_genre_weights, p_emotional_register, p_desire_targets, p_explicitness_default,
-- p_style_references, p_setting_preference) are kept as no-ops so calls that still
-- pass them don't error. The application layer no longer writes them (prompt-12).

CREATE OR REPLACE FUNCTION public.upsert_desire_profile(
  p_user_id              UUID,
  p_display_name         TEXT        DEFAULT NULL,
  -- Deprecated params retained for call-site compatibility:
  p_genre_weights        JSONB       DEFAULT NULL,
  p_emotional_register   TEXT[]      DEFAULT NULL,
  p_desire_targets       TEXT        DEFAULT NULL,
  p_explicitness_default SMALLINT    DEFAULT NULL,
  p_participant_mode     TEXT        DEFAULT NULL,
  p_hard_limits          TEXT[]      DEFAULT NULL,
  p_three_words          TEXT[]      DEFAULT NULL,
  p_style_references     TEXT[]      DEFAULT NULL,
  p_setting_preference   JSONB       DEFAULT NULL,
  p_language             TEXT        DEFAULT NULL,
  p_age_band             TEXT        DEFAULT NULL,
  p_prose_rhythm         TEXT        DEFAULT NULL,
  -- New param (prompt-12):
  p_last_explicitness    SMALLINT    DEFAULT NULL
)
RETURNS public.desire_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.desire_profiles;
BEGIN
  INSERT INTO public.desire_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.desire_profiles SET
    display_name           = COALESCE(p_display_name,        display_name),
    participant_mode       = COALESCE(p_participant_mode,    participant_mode),
    hard_limits            = COALESCE(p_hard_limits,         hard_limits),
    three_words            = COALESCE(p_three_words,         three_words),
    language               = COALESCE(p_language,            language),
    age_band               = COALESCE(p_age_band,            age_band),
    prose_rhythm           = COALESCE(p_prose_rhythm,        prose_rhythm),
    last_explicitness_used = COALESCE(p_last_explicitness,   last_explicitness_used)
  WHERE user_id = p_user_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;
