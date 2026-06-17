-- Yearns — Migration 0004: Seed initial prompt version
-- Seeds the first active prompt version record.
-- The actual prompt text lives in /src/lib/prompt-engine.ts —
-- this table tracks versions and quality scores, not the text itself.
-- The prompt_version string is passed to buildPrompt() for logging/A-B purposes.

INSERT INTO public.prompt_versions (
  version,
  is_active,
  description,
  deployed_at
) VALUES (
  '1.0.0',
  true,
  'Initial V1 prompt. Layered construction: hard limits → user limits → explicitness → craft → language. Seven narrative sections: world → emotional register → setting → protagonist → desire target → three words → style reference.',
  now()
);
