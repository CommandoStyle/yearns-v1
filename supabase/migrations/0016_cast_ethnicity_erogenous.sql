-- erogenous_notes: schema-only, NO UI or prompt wiring in this version.
-- Intended for is_self=true rows only. UX/copy to be designed separately.
ALTER TABLE public.cast_characters
  ADD COLUMN IF NOT EXISTS erogenous_notes TEXT;

-- ethnicity: for both self and non-self cast rows.
-- Vocabulary is provisional (see SelfDescriptionFlow.tsx for validation flags).
ALTER TABLE public.cast_characters
  ADD COLUMN IF NOT EXISTS ethnicity TEXT;
