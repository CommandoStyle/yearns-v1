-- Yearns — Migration 0001: Initial schema
-- Run via: supabase db push
-- Never edit this file after applying. Add a new migration instead.
--
-- Table creation order respects foreign key dependencies:
-- users → desire_profiles, subscriptions, yearns, yearn_tails,
--         generation_logs, implicit_signals
-- prompt_versions (standalone)

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Extends Supabase's auth.users with application-level fields.
-- auth.users is managed by Supabase Auth — we never write to it directly.
-- This table is created/populated via a trigger on auth.users insert.

CREATE TABLE public.users (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT        NOT NULL,

  -- Age verification
  -- Set to true ONLY by the Veriff webhook after successful ID check.
  -- Never set client-side. Never bypassed.
  age_verified        BOOLEAN     NOT NULL DEFAULT false,
  age_verified_at     TIMESTAMPTZ,
  age_verified_method TEXT,                -- 'veriff' | 'yoti'

  -- Subscription state (denormalised from subscriptions table for fast reads)
  subscription_tier   TEXT        NOT NULL DEFAULT 'free'
                                  CHECK (subscription_tier IN ('free', 'pro')),
  subscription_status TEXT,               -- 'active' | 'cancelled' | 'past_due' | null
  -- Effective tier = 'pro' only when tier='pro' AND status='active'

  -- Usage tracking (free tier enforcement)
  monthly_usage       INTEGER     NOT NULL DEFAULT 0,
  usage_reset_at      TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month',

  -- Profile completeness (drives progressive unlock prompts)
  onboarding_complete BOOLEAN     NOT NULL DEFAULT false,
  session_count       INTEGER     NOT NULL DEFAULT 0,

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: auto-create users row on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Desire profiles ──────────────────────────────────────────────────────────
-- One row per user. The prompt engine's primary input.
-- Populated progressively: onboarding fills the first 5 fields,
-- subsequent sessions add the rest.
-- All fields nullable — engine degrades gracefully on empty profile.

CREATE TABLE public.desire_profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Onboarding fields (populated in first session)
  display_name        TEXT,                  -- first name or alias, max 24 chars
  genre_weights       JSONB,
  -- Schema: {"contemporary": 0.8, "historical": 0.3, "fantasy": 0.6,
  --          "scifi": 0.0, "romantic": 0.5, "dark": 0.2}
  -- All genre keys optional. Missing = 0 weight.

  emotional_register  TEXT[],
  -- Ordered array of: 'desired'|'powerful'|'surrendered'|'adored'|
  --                   'forbidden'|'dangerous'|'seen'|'surprised'
  -- First element = primary register.

  desire_targets      TEXT,                  -- free text: "a man, powerful, older"

  explicitness_default SMALLINT DEFAULT 2
                                  CHECK (explicitness_default BETWEEN 1 AND 4),
  -- 1=suggestive 2=sensual 3=explicit 4=unrestricted

  -- Progressive unlock fields (added session by session)
  participant_mode    TEXT        DEFAULT 'voyeur'
                                  CHECK (participant_mode IN ('participant', 'voyeur')),

  hard_limits         TEXT[],
  -- Array of exclusion strings. Honoured absolutely by prompt engine.
  -- e.g. ["violence", "group scenarios", "workplace settings"]

  three_words         TEXT[],
  -- Exactly 3 elements when set. e.g. ["slow", "powerful", "inevitable"]

  style_references    TEXT[],
  -- Free text references. e.g. ["Atonement library scene", "Rebecca"]

  setting_preference  JSONB,
  -- Schema: {"bedroom": 0.7, "hotel": 0.4, "outdoors": 0.2}

  language            TEXT        DEFAULT 'en'
                                  CHECK (language IN ('en', 'fr', 'it', 'ja')),

  -- Implicit signal weights (updated by signal processor)
  -- These feed back into genre_weights and emotional_register over time.
  signal_weights      JSONB       DEFAULT '{}',

  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER desire_profiles_updated_at
  BEFORE UPDATE ON public.desire_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_desire_profiles_user_id ON public.desire_profiles(user_id);

-- ─── Subscriptions ────────────────────────────────────────────────────────────
-- Mirrors Stripe subscription state. Synced via Stripe webhook.
-- Source of truth for billing. users.subscription_tier is a fast-read cache.

CREATE TABLE public.subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Stripe identifiers
  stripe_customer_id     TEXT        UNIQUE,
  stripe_subscription_id TEXT        UNIQUE,
  stripe_price_id        TEXT,

  -- CCBill identifiers (parallel processor)
  ccbill_subscription_id TEXT        UNIQUE,

  -- State
  plan                   TEXT        NOT NULL DEFAULT 'free'
                                     CHECK (plan IN ('free', 'pro_monthly', 'pro_annual')),
  status                 TEXT
                                     CHECK (status IN ('active', 'cancelled', 'past_due',
                                                       'incomplete', 'trialing', null)),

  -- Billing period
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     DEFAULT false,

  -- Timestamps
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);

-- ─── Yearns (saved stories — metadata only) ───────────────────────────────────
-- A row is created ONLY when a user explicitly saves a Yearn (Pro feature).
-- No story text is stored here. title is AI-generated from first sentence.
-- The story itself lives in Supabase Storage (encrypted), keyed by id.

CREATE TABLE public.yearns (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Story metadata
  title           TEXT,                   -- auto-generated, max 80 chars
  genre           TEXT,
  setting         TEXT,
  explicitness    SMALLINT    CHECK (explicitness BETWEEN 1 AND 4),
  length_mins     SMALLINT,
  word_count      INTEGER,
  language        TEXT        DEFAULT 'en',
  prompt_version  TEXT,

  -- Continuation
  -- tail_text is stored separately in yearn_tails for ephemeral use.
  -- is_continuable flags that a tail exists and hasn't expired.
  is_continuable  BOOLEAN     DEFAULT false,

  -- User actions
  is_saved        BOOLEAN     NOT NULL DEFAULT true,
  rating          SMALLINT    CHECK (rating BETWEEN 1 AND 5),
  -- Rating UI: lip-bite emoji scale 1–5

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER yearns_updated_at
  BEFORE UPDATE ON public.yearns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_yearns_user_id ON public.yearns(user_id);
CREATE INDEX idx_yearns_user_created ON public.yearns(user_id, created_at DESC);

-- ─── Yearn tails (continuation context — ephemeral) ───────────────────────────
-- Stores the last 200 words of the most recent generation per user.
-- Used for story continuation. NOT linked to a saved yearn (may not exist).
-- Auto-expires after 30 days. Pro users only.
-- One row per user — upserted on each generation.

CREATE TABLE public.yearn_tails (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

  -- Last 200 words of the story (enough for Claude to continue the thread)
  tail_text   TEXT        NOT NULL,
  -- Note: 200 words of erotic fiction is not PII but is sensitive.
  -- Encrypt at column level in production using pgcrypto if required
  -- by your data protection assessment.

  prompt_version TEXT,
  yearn_id    UUID        REFERENCES public.yearns(id) ON DELETE SET NULL,
  -- null if the story was not saved

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days'
);

CREATE INDEX idx_yearn_tails_user_id ON public.yearn_tails(user_id);
CREATE INDEX idx_yearn_tails_expires ON public.yearn_tails(expires_at);

-- ─── Generation logs ─────────────────────────────────────────────────────────
-- Analytics and quality monitoring. NEVER stores story content.
-- Used for: A/B prompt version comparison, error rate tracking,
--           usage analytics, quality trainer dashboards.

CREATE TABLE public.generation_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Generation parameters
  prompt_version  TEXT        NOT NULL,
  explicitness    SMALLINT    CHECK (explicitness BETWEEN 1 AND 4),
  setting         TEXT,
  language        TEXT,
  length_mins     SMALLINT,
  is_continuation BOOLEAN     DEFAULT false,

  -- Outcome
  status          TEXT        NOT NULL
                              CHECK (status IN ('success', 'error',
                                                'input_filtered', 'output_filtered',
                                                'cancelled')),
  word_count      INTEGER     DEFAULT 0,
  duration_ms     INTEGER,    -- generation time in milliseconds

  -- Error details (never includes story content)
  error_code      TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partition by month in production when volume warrants it.
-- For V1: simple table is fine.
CREATE INDEX idx_gen_logs_user_id ON public.generation_logs(user_id);
CREATE INDEX idx_gen_logs_prompt_version ON public.generation_logs(prompt_version);
CREATE INDEX idx_gen_logs_created ON public.generation_logs(created_at DESC);
CREATE INDEX idx_gen_logs_status ON public.generation_logs(status);

-- ─── Implicit signals ─────────────────────────────────────────────────────────
-- Behavioural signals from reading sessions.
-- Processed asynchronously to update desire_profiles.signal_weights.
-- Batched — not written per-token.

CREATE TABLE public.implicit_signals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  event_type  TEXT        NOT NULL,
  -- Values: 'generation_completed' | 'story_saved' | 'story_abandoned' |
  --         'story_extended' | 'dial_adjusted' | 'explicitness_adjusted' |
  --         'rating_given'

  event_data  JSONB       NOT NULL DEFAULT '{}',
  -- Flexible payload per event type. Never includes story content.
  -- e.g. {"word_count": 1750, "dial_level": 3, "genre": "contemporary"}

  processed   BOOLEAN     NOT NULL DEFAULT false,
  -- Set to true after signal_processor has incorporated into profile weights

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signals_user_id ON public.implicit_signals(user_id);
CREATE INDEX idx_signals_unprocessed ON public.implicit_signals(processed, created_at)
  WHERE processed = false;

-- ─── Prompt versions ─────────────────────────────────────────────────────────
-- Versioned prompt templates. The prompt engine loads the active version
-- at generation time. Never hardcode prompt text in application code.
-- A/B testing: assign users to cohorts via users table (add cohort column in
-- a future migration) and load version by cohort.

CREATE TABLE public.prompt_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version         TEXT        NOT NULL UNIQUE,  -- semver e.g. '1.0.0'
  is_active       BOOLEAN     NOT NULL DEFAULT false,
  description     TEXT,       -- human notes on what changed

  -- Quality metrics (updated by trainer feedback pipeline)
  avg_score       NUMERIC(3,2),   -- 1.00–5.00
  sample_count    INTEGER     DEFAULT 0,

  -- Deployment
  deployed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one version should be active at a time.
-- Enforced by application convention (not DB constraint) to allow
-- phased rollouts where two versions briefly coexist.
CREATE INDEX idx_prompt_versions_active ON public.prompt_versions(is_active)
  WHERE is_active = true;
