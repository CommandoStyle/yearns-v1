CREATE TABLE public.wardrobe_items (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  description TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wardrobe_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wardrobe_items: own rows"
  ON public.wardrobe_items
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
