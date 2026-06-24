-- Yearns — Migration 0012: Add prose_rhythm to upsert_desire_profile function
-- Must run after 0011 (which adds the prose_rhythm column).

CREATE OR REPLACE FUNCTION public.upsert_desire_profile(
  p_user_id              UUID,
  p_display_name         TEXT        DEFAULT NULL,
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
  p_prose_rhythm         TEXT        DEFAULT NULL
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
    display_name         = COALESCE(p_display_name,         display_name),
    genre_weights        = CASE WHEN p_genre_weights IS NOT NULL
                                THEN genre_weights || p_genre_weights
                                ELSE genre_weights END,
    emotional_register   = COALESCE(p_emotional_register,   emotional_register),
    desire_targets       = COALESCE(p_desire_targets,       desire_targets),
    explicitness_default = COALESCE(p_explicitness_default, explicitness_default),
    participant_mode     = COALESCE(p_participant_mode,     participant_mode),
    hard_limits          = COALESCE(p_hard_limits,          hard_limits),
    three_words          = COALESCE(p_three_words,          three_words),
    style_references     = COALESCE(p_style_references,     style_references),
    setting_preference   = CASE WHEN p_setting_preference IS NOT NULL
                                THEN setting_preference || p_setting_preference
                                ELSE setting_preference END,
    language             = COALESCE(p_language,             language),
    age_band             = COALESCE(p_age_band,             age_band),
    prose_rhythm         = COALESCE(p_prose_rhythm,         prose_rhythm)
  WHERE user_id = p_user_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;
