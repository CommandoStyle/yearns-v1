-- Yearns — Migration 0008: ADR-003 (Here and Now) + age_band profile field
-- 2026-06

-- ─── Deprecate genre_weights ──────────────────────────────────────────────────
-- Column is no longer written to or read by buildPrompt() per ADR-003.
-- Retained for rollback safety; may be dropped in a future migration once
-- ADR-003 is confirmed stable (typically after one full release cycle).

COMMENT ON COLUMN public.desire_profiles.genre_weights IS
  'DEPRECATED as of ADR-003 (Here and Now positioning, 2026-06). No longer
   written to or read by buildPrompt(). Retained for rollback safety; may be
   dropped in a future migration once ADR-003 is confirmed stable.';

-- ─── Add age_band ─────────────────────────────────────────────────────────────
-- Optional life-stage register calibration. Not a legal age gate (age_verified
-- handles that). Purely a creative/prompt input — shapes tone and vernacular.
-- Collected as a band, not exact age, for privacy (see prompt-9 spec).

ALTER TABLE public.desire_profiles
  ADD COLUMN IF NOT EXISTS age_band TEXT
  CHECK (age_band IN ('18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'));

COMMENT ON COLUMN public.desire_profiles.age_band IS
  'Optional life-stage band for prompt register calibration. Not used for
   access control. Values: 18_24 | 25_34 | 35_44 | 45_54 | 55_64 | 65_plus.';
