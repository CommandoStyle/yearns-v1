-- Yearns — Migration 0010: cast_characters table
-- Persistent character roster. One special row per user (is_self=true)
-- models her own physical self-description. The partial unique index
-- enforces exactly one self row per user without a CHECK constraint
-- (which can't reference other rows).

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE public.cast_characters (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  is_self          BOOLEAN     NOT NULL DEFAULT false,
  -- true for exactly one row per user: her own physical self-description.

  name             TEXT,
  -- For is_self=true: pre-fillable from display_name but editable.
  -- For others: free text, never a real named public figure, not required.

  gender           TEXT        CHECK (gender IN ('man', 'woman', 'unspecified')),
  -- null / irrelevant for is_self rows.

  role             TEXT,
  -- Curated category or free text. Null for is_self rows — she has no
  -- "role" relative to herself.

  traits           TEXT[],
  -- Max 2 entries. Same curated list as per-story ephemeral characters.

  -- Physical description fields — all nullable.
  -- Populated via the progressive-disclosure self-description UX (Part 2).
  -- Available on any cast member, not just is_self.
  hair_colour      TEXT,
  eye_colour       TEXT,

  -- VOCABULARY NOTE: build descriptors below were chosen provisionally.
  -- Flag for post-launch validation with real users and trainers before
  -- treating this word list as final. Options currently: 'slender',
  -- 'curvy', 'athletic', 'soft', plus free-text override.
  build            TEXT,

  height           TEXT,
  -- Kept loose — free text or band (e.g. "tall", "5'6\"").

  additional_detail TEXT,
  -- Open free-text "anything else" field. Cap at ~300 chars enforced
  -- at the application layer, not via a DB constraint.

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Constraints & indexes ────────────────────────────────────────────────────

-- Exactly one is_self=true row per user (partial unique index, not CHECK).
CREATE UNIQUE INDEX idx_cast_one_self_per_user
  ON public.cast_characters(user_id)
  WHERE is_self = true;

CREATE INDEX idx_cast_user_id ON public.cast_characters(user_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.cast_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cast_characters: own rows"
  ON public.cast_characters
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Updated-at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER cast_characters_updated_at
  BEFORE UPDATE ON public.cast_characters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
