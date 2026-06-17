-- Yearns — Migration 0002: Row Level Security policies
-- RLS is the last line of defence at the database layer.
-- Application code also scopes all queries to auth.uid() — belt and braces.
-- Never disable RLS on any table. Never add a policy that returns
-- rows from a different user's account.

-- ─── Enable RLS on all tables ─────────────────────────────────────────────────

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desire_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yearns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yearn_tails        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implicit_signals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions    ENABLE ROW LEVEL SECURITY;

-- ─── users ────────────────────────────────────────────────────────────────────
-- Users can read and update their own row only.
-- Insert is handled by the auth trigger (SECURITY DEFINER function).
-- No user can delete their own row (requires admin action).

CREATE POLICY "users: own row read"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users: own row update"
  ON public.users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Prevent client from setting age_verified directly.
    -- This is enforced at application layer too; RLS cannot check
    -- individual column values in UPDATE policies without triggers.
    -- The Veriff webhook uses service role, bypassing RLS — that is correct.
  );

-- ─── desire_profiles ─────────────────────────────────────────────────────────

CREATE POLICY "desire_profiles: own row read"
  ON public.desire_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "desire_profiles: own row insert"
  ON public.desire_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "desire_profiles: own row update"
  ON public.desire_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── subscriptions ───────────────────────────────────────────────────────────
-- Users can read their own subscription.
-- Writes are service-role only (Stripe webhook). No client writes.

CREATE POLICY "subscriptions: own row read"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- ─── yearns (saved stories) ──────────────────────────────────────────────────

CREATE POLICY "yearns: own rows read"
  ON public.yearns FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "yearns: own rows insert"
  ON public.yearns FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "yearns: own rows update"
  ON public.yearns FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "yearns: own rows delete"
  ON public.yearns FOR DELETE
  USING (user_id = auth.uid());

-- ─── yearn_tails ─────────────────────────────────────────────────────────────

CREATE POLICY "yearn_tails: own row read"
  ON public.yearn_tails FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "yearn_tails: own row insert"
  ON public.yearn_tails FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "yearn_tails: own row update"
  ON public.yearn_tails FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── generation_logs ─────────────────────────────────────────────────────────
-- Read-only for users (their own logs only).
-- Writes are service-role only (API route). No client writes.

CREATE POLICY "generation_logs: own rows read"
  ON public.generation_logs FOR SELECT
  USING (user_id = auth.uid());

-- ─── implicit_signals ────────────────────────────────────────────────────────
-- Users insert their own signals (via /api/profile/signal route).
-- Read is service-role only (signal processor job).

CREATE POLICY "implicit_signals: own rows insert"
  ON public.implicit_signals FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ─── prompt_versions ─────────────────────────────────────────────────────────
-- Public read — any authenticated user can read prompt versions.
-- Writes are admin/service-role only.

CREATE POLICY "prompt_versions: authenticated read"
  ON public.prompt_versions FOR SELECT
  TO authenticated
  USING (true);
