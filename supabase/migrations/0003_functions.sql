-- Yearns — Migration 0003: Functions and stored procedures
-- All functions use SECURITY DEFINER to run with elevated privileges
-- where needed (e.g. cross-table updates from API routes).
-- search_path is always set explicitly to prevent search path injection.

-- ─── increment_monthly_usage ─────────────────────────────────────────────────
-- Called by /api/generate after a successful free-tier generation.
-- Atomic increment — safe under concurrent requests.
-- Also resets the counter if the reset date has passed (handles month rollover).

CREATE OR REPLACE FUNCTION public.increment_monthly_usage(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    monthly_usage = CASE
      WHEN now() >= usage_reset_at THEN 1  -- new month: reset to 1
      ELSE COALESCE(monthly_usage, 0) + 1
    END,
    usage_reset_at = CASE
      WHEN now() >= usage_reset_at
        THEN date_trunc('month', now()) + interval '1 month'
      ELSE usage_reset_at
    END,
    session_count = COALESCE(session_count, 0) + 1
  WHERE id = p_user_id;
END;
$$;

-- ─── increment_session_count ──────────────────────────────────────────────────
-- Called for Pro users (no monthly limit, but track sessions for
-- progressive profile unlock logic).

CREATE OR REPLACE FUNCTION public.increment_session_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET session_count = COALESCE(session_count, 0) + 1
  WHERE id = p_user_id;
END;
$$;

-- ─── get_active_prompt_version ───────────────────────────────────────────────
-- Returns the currently active prompt version string.
-- Called by /api/generate. Cached at application layer (5 min TTL).

CREATE OR REPLACE FUNCTION public.get_active_prompt_version()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE  -- result won't change within a transaction; allows query caching
AS $$
  SELECT version
  FROM public.prompt_versions
  WHERE is_active = true
  ORDER BY deployed_at DESC NULLS LAST
  LIMIT 1;
$$;

-- ─── upsert_desire_profile ────────────────────────────────────────────────────
-- Safely creates or updates a desire profile in a single call.
-- Called by onboarding flow and progressive profile updates.
-- Uses JSONB merge for partial updates (only provided fields change).

CREATE OR REPLACE FUNCTION public.upsert_desire_profile(
  p_user_id           UUID,
  p_display_name      TEXT        DEFAULT NULL,
  p_genre_weights     JSONB       DEFAULT NULL,
  p_emotional_register TEXT[]     DEFAULT NULL,
  p_desire_targets    TEXT        DEFAULT NULL,
  p_explicitness_default SMALLINT DEFAULT NULL,
  p_participant_mode  TEXT        DEFAULT NULL,
  p_hard_limits       TEXT[]      DEFAULT NULL,
  p_three_words       TEXT[]      DEFAULT NULL,
  p_style_references  TEXT[]      DEFAULT NULL,
  p_setting_preference JSONB      DEFAULT NULL,
  p_language          TEXT        DEFAULT NULL
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
    display_name        = COALESCE(p_display_name,        display_name),
    genre_weights       = CASE WHEN p_genre_weights IS NOT NULL
                               THEN genre_weights || p_genre_weights  -- merge, don't replace
                               ELSE genre_weights END,
    emotional_register  = COALESCE(p_emotional_register,  emotional_register),
    desire_targets      = COALESCE(p_desire_targets,      desire_targets),
    explicitness_default = COALESCE(p_explicitness_default, explicitness_default),
    participant_mode    = COALESCE(p_participant_mode,    participant_mode),
    hard_limits         = COALESCE(p_hard_limits,         hard_limits),
    three_words         = COALESCE(p_three_words,         three_words),
    style_references    = COALESCE(p_style_references,    style_references),
    setting_preference  = CASE WHEN p_setting_preference IS NOT NULL
                               THEN setting_preference || p_setting_preference
                               ELSE setting_preference END,
    language            = COALESCE(p_language,            language)
  WHERE user_id = p_user_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- ─── process_implicit_signal ──────────────────────────────────────────────────
-- Updates desire_profiles.signal_weights based on a behavioural signal.
-- Called by the signal processor (async job, not on the hot path).
-- Simple weighted update — more sophisticated learning in V2/V3.

CREATE OR REPLACE FUNCTION public.process_implicit_signal(p_signal_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sig         public.implicit_signals;
  uid         UUID;
  event_data  JSONB;
BEGIN
  SELECT * INTO sig FROM public.implicit_signals WHERE id = p_signal_id;
  IF NOT FOUND OR sig.processed THEN RETURN; END IF;

  uid := sig.user_id;
  event_data := sig.event_data;

  CASE sig.event_type

    WHEN 'story_saved' THEN
      -- Strong positive signal: up-weight genre, emotional register, setting
      UPDATE public.desire_profiles SET
        signal_weights = signal_weights || jsonb_build_object(
          'saved_count', COALESCE((signal_weights->>'saved_count')::int, 0) + 1
        )
      WHERE user_id = uid;

    WHEN 'story_extended' THEN
      -- Strongest positive signal
      UPDATE public.desire_profiles SET
        signal_weights = signal_weights || jsonb_build_object(
          'extended_count', COALESCE((signal_weights->>'extended_count')::int, 0) + 1
        )
      WHERE user_id = uid;

    WHEN 'story_abandoned' THEN
      -- Negative signal — track position to understand where interest dropped
      UPDATE public.desire_profiles SET
        signal_weights = signal_weights || jsonb_build_object(
          'abandoned_count', COALESCE((signal_weights->>'abandoned_count')::int, 0) + 1
        )
      WHERE user_id = uid;

    WHEN 'rating_given' THEN
      -- Explicit feedback — highest quality signal
      UPDATE public.desire_profiles SET
        signal_weights = signal_weights || jsonb_build_object(
          'ratings', COALESCE(signal_weights->'ratings', '[]'::jsonb)
                     || jsonb_build_array(event_data->'rating')
        )
      WHERE user_id = uid;

    ELSE
      -- Unknown signal type — log but don't error
      NULL;

  END CASE;

  -- Mark processed
  UPDATE public.implicit_signals SET processed = true WHERE id = p_signal_id;
END;
$$;

-- ─── sync_subscription_to_user ───────────────────────────────────────────────
-- Called by Stripe webhook handler after subscription state changes.
-- Keeps users.subscription_tier and users.subscription_status in sync
-- with the subscriptions table. Single source of truth = subscriptions table.

CREATE OR REPLACE FUNCTION public.sync_subscription_to_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub public.subscriptions;
BEGIN
  SELECT * INTO sub FROM public.subscriptions WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    UPDATE public.users SET
      subscription_tier = 'free',
      subscription_status = null
    WHERE id = p_user_id;
    RETURN;
  END IF;

  UPDATE public.users SET
    subscription_tier = CASE
      WHEN sub.plan IN ('pro_monthly', 'pro_annual') AND sub.status = 'active'
        THEN 'pro'
      ELSE 'free'
    END,
    subscription_status = sub.status
  WHERE id = p_user_id;
END;
$$;

-- ─── cleanup_expired_tails ────────────────────────────────────────────────────
-- Deletes expired yearn_tails rows. Run as a scheduled job (pg_cron or
-- Supabase Edge Function cron) daily.

CREATE OR REPLACE FUNCTION public.cleanup_expired_tails()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.yearn_tails
  WHERE expires_at < now()
  RETURNING 1;
$$;

-- Schedule via Supabase dashboard → Database → Extensions → pg_cron:
-- SELECT cron.schedule('cleanup-tails', '0 3 * * *', 'SELECT cleanup_expired_tails()');

-- ─── reset_monthly_usage (admin utility) ─────────────────────────────────────
-- Manual reset for a specific user (support use case).
-- Service role only — not exposed via API.

CREATE OR REPLACE FUNCTION public.reset_monthly_usage(p_user_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
  SET
    monthly_usage = 0,
    usage_reset_at = date_trunc('month', now()) + interval '1 month'
  WHERE id = p_user_id;
$$;
