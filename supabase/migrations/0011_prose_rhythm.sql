-- Yearns — Migration 0011: prose_rhythm profile field (Craft Standard v2)
-- Optional user preference for sentence rhythm. no_preference is the default
-- and a fully valid complete state — never required.

ALTER TABLE public.desire_profiles
  ADD COLUMN IF NOT EXISTS prose_rhythm TEXT NOT NULL DEFAULT 'no_preference'
  CHECK (prose_rhythm IN ('no_preference', 'shorter_punchier', 'longer_lingering'));

COMMENT ON COLUMN public.desire_profiles.prose_rhythm IS
  'Optional sentence rhythm preference. no_preference = craft standard default.
   shorter_punchier = favour brevity; longer_lingering = favour accumulation.
   Fragment-for-emphasis tic suppression applies regardless of this setting.';
