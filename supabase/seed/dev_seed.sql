-- Yearns — Dev seed
-- Creates test users for local development.
-- NEVER run against production. Local Supabase instance only.
--
-- Usage:
--   supabase db reset  (runs migrations + this seed automatically)
--   or manually: psql $DATABASE_URL < supabase/seed/dev_seed.sql
--
-- Test accounts:
--   free@yearns.test    — free tier, age verified, partial profile
--   pro@yearns.test     — pro tier, age verified, full profile
--   unverified@yearns.test — free tier, NOT age verified (for gate testing)

DO $$
DECLARE
  free_user_id    UUID := '00000000-0000-0000-0000-000000000001';
  pro_user_id     UUID := '00000000-0000-0000-0000-000000000002';
  unverified_id   UUID := '00000000-0000-0000-0000-000000000003';
BEGIN

-- ── Free tier test user ────────────────────────────────────────────────────
-- Use for: testing free tier limits, onboarding flow, basic generation.
-- Auth credentials: free@yearns.test / testpassword123

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  free_user_id,
  'free@yearns.test',
  crypt('testpassword123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET
  age_verified = true,
  age_verified_at = now() - interval '1 day',
  age_verified_method = 'veriff',
  subscription_tier = 'free',
  monthly_usage = 2,  -- simulate 2 of 5 used
  onboarding_complete = true,
  session_count = 3
WHERE id = free_user_id;

INSERT INTO public.desire_profiles (
  user_id,
  display_name,
  genre_weights,
  emotional_register,
  desire_targets,
  explicitness_default,
  participant_mode,
  language
) VALUES (
  free_user_id,
  'Isabelle',
  '{"contemporary": 0.8, "historical": 0.4, "romantic": 0.6}',
  ARRAY['desired', 'surrendered'],
  'a man, powerful, a little older',
  2,
  'participant',
  'en'
) ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  genre_weights = EXCLUDED.genre_weights,
  emotional_register = EXCLUDED.emotional_register,
  desire_targets = EXCLUDED.desire_targets,
  explicitness_default = EXCLUDED.explicitness_default,
  participant_mode = EXCLUDED.participant_mode;

-- ── Pro tier test user ────────────────────────────────────────────────────
-- Use for: testing all Pro features, saved Yearns, continuation, exports.
-- Auth credentials: pro@yearns.test / testpassword123

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  pro_user_id,
  'pro@yearns.test',
  crypt('testpassword123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET
  age_verified = true,
  age_verified_at = now() - interval '7 days',
  age_verified_method = 'veriff',
  subscription_tier = 'pro',
  subscription_status = 'active',
  onboarding_complete = true,
  session_count = 12
WHERE id = pro_user_id;

INSERT INTO public.subscriptions (
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  plan,
  status,
  current_period_start,
  current_period_end
) VALUES (
  pro_user_id,
  'cus_test_pro_user',
  'sub_test_pro_user',
  'price_test_pro_monthly',
  'pro_monthly',
  'active',
  now() - interval '5 days',
  now() + interval '25 days'
) ON CONFLICT (user_id) DO UPDATE SET
  status = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end;

INSERT INTO public.desire_profiles (
  user_id,
  display_name,
  genre_weights,
  emotional_register,
  desire_targets,
  explicitness_default,
  participant_mode,
  hard_limits,
  three_words,
  style_references,
  setting_preference,
  language
) VALUES (
  pro_user_id,
  'Margot',
  '{"historical": 0.9, "dark": 0.6, "romantic": 0.4}',
  ARRAY['forbidden', 'desired', 'powerful'],
  'a woman, dangerous, unknowable',
  3,
  'voyeur',
  ARRAY['group scenarios', 'graphic violence'],
  ARRAY['slow', 'charged', 'inevitable'],
  ARRAY['Atonement library scene', 'Carol (film)', 'Portrait of a Lady on Fire'],
  '{"hotel": 0.8, "outdoors": 0.5, "bedroom": 0.3}',
  'fr'
) ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  genre_weights = EXCLUDED.genre_weights,
  emotional_register = EXCLUDED.emotional_register,
  desire_targets = EXCLUDED.desire_targets,
  explicitness_default = EXCLUDED.explicitness_default,
  participant_mode = EXCLUDED.participant_mode,
  hard_limits = EXCLUDED.hard_limits,
  three_words = EXCLUDED.three_words,
  style_references = EXCLUDED.style_references,
  setting_preference = EXCLUDED.setting_preference,
  language = EXCLUDED.language;

-- ── Age-unverified test user ──────────────────────────────────────────────
-- Use for: testing the age gate rejection path in /api/generate.
-- Auth credentials: unverified@yearns.test / testpassword123
-- Expect: 403 age_verification_required on any generation attempt.

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  unverified_id,
  'unverified@yearns.test',
  crypt('testpassword123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now()
) ON CONFLICT (id) DO NOTHING;

-- users row auto-created by trigger with age_verified=false — no update needed.

END $$;
