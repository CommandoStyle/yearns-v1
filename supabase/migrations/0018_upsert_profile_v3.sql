DROP FUNCTION IF EXISTS public.upsert_desire_profile(uuid,text,text,text[],text[],text,text,text,smallint);

CREATE FUNCTION public.upsert_desire_profile(
  p_user_id            UUID,
  p_display_name       TEXT      DEFAULT NULL,
  p_language           TEXT      DEFAULT NULL,
  p_three_words        TEXT[]    DEFAULT NULL,
  p_hard_limits        TEXT[]    DEFAULT NULL,
  p_participant_mode   TEXT      DEFAULT NULL,
  p_age_band           TEXT      DEFAULT NULL,
  p_prose_rhythm       TEXT      DEFAULT NULL,
  p_last_explicitness  SMALLINT  DEFAULT NULL,
  p_last_mode          TEXT      DEFAULT NULL,
  p_last_length_mins   SMALLINT  DEFAULT NULL,
  p_country            TEXT      DEFAULT NULL
)
RETURNS public.desire_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.desire_profiles;
BEGIN
  INSERT INTO public.desire_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.desire_profiles SET
    display_name           = COALESCE(p_display_name,      display_name),
    language               = COALESCE(p_language,          language),
    three_words            = COALESCE(p_three_words,       three_words),
    hard_limits            = COALESCE(p_hard_limits,       hard_limits),
    participant_mode       = COALESCE(p_participant_mode,  participant_mode),
    age_band               = COALESCE(p_age_band,          age_band),
    prose_rhythm           = COALESCE(p_prose_rhythm,      prose_rhythm),
    last_explicitness_used = COALESCE(p_last_explicitness, last_explicitness_used),
    last_mode_used         = COALESCE(p_last_mode,         last_mode_used),
    last_length_mins_used  = COALESCE(p_last_length_mins,  last_length_mins_used),
    country                = COALESCE(p_country,           country)
  WHERE user_id = p_user_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;
