-- Migration 0009: WebAuthn / passkey credential storage

CREATE TABLE public.webauthn_credentials (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  credential_id  TEXT        NOT NULL UNIQUE,
  public_key     TEXT        NOT NULL,   -- base64-encoded COSE key
  counter        BIGINT      NOT NULL DEFAULT 0,
  device_label   TEXT,                   -- e.g. "iPhone — Face ID"
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at   TIMESTAMPTZ
);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webauthn_credentials: own rows"
  ON public.webauthn_credentials
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX webauthn_credentials_user_id_idx ON public.webauthn_credentials (user_id);
