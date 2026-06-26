ALTER TABLE public.desire_profiles
  ADD COLUMN IF NOT EXISTS last_mode_used         TEXT     DEFAULT 'participant',
  ADD COLUMN IF NOT EXISTS last_length_mins_used  SMALLINT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS country                TEXT;
