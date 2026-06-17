/**
 * Yearns — Content filter
 * Two-pass safety layer: input (pre-generation) and output (post-generation).
 *
 * V1 implementation: keyword blocklist + pattern matching.
 * Fast, predictable, no network calls, no AI inference cost.
 *
 * V2 upgrade path: replace outputFilter with a lightweight classifier
 * call (separate Claude call with a safety-focused system prompt) for
 * edge cases the blocklist misses. Keep inputFilter as blocklist — it's
 * on the critical path and must stay sub-10ms.
 */

import type { SettingType, SupportedLanguage } from '@/lib/prompt-engine'

// ─── Input filter ─────────────────────────────────────────────────────────────
// Runs before generation. Checks request parameters only — not user content,
// not profile fields (those are validated at profile update time).
// Returns null if clean, violation code string if blocked.

interface InputFilterParams {
  setting: SettingType
  language?: SupportedLanguage
  continuation_id?: string
}

export function inputFilter(params: InputFilterParams): string | null {
  // Language whitelist
  const validLanguages: SupportedLanguage[] = ['en', 'fr', 'it', 'ja']
  if (params.language && !validLanguages.includes(params.language)) {
    return 'unsupported_language'
  }

  // Continuation ID format (UUID v4)
  if (params.continuation_id) {
    const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidV4Pattern.test(params.continuation_id)) {
      return 'invalid_continuation_id'
    }
  }

  return null
}

// ─── Output filter ────────────────────────────────────────────────────────────
// Runs after generation completes. Checks the full story text.
// Must complete in <500ms (on the critical path to closing the SSE stream).
// Returns null if clean, violation code string if flagged.
//
// This is a backstop — the primary enforcement is the system prompt.
// The filter catches edge cases where the model drifts despite instructions.

// Terms that, if present, indicate a content policy violation.
// Deliberately conservative — false positives here mean a story is
// discarded (bad UX); false negatives mean a policy violation reaches a user (worse).
// Tune based on observed outputs during trainer review sessions.

const HARD_LIMIT_PATTERNS: RegExp[] = [
  // Age-related — catches common ways models signal a minor character
  /\b(years?\s+old|aged?)\s+1[0-7]\b/i,
  /\b(1[0-7])[- ]year[- ]old\b/i,
  /\bshe(?:'s| is| was)\s+(?:only\s+)?1[0-7]\b/i,
  /\b(?:teen|tween|preteen|underage|minor)\b/i,
  // The above are intentionally broad. Review false positives in trainer sessions
  // and add exceptions as needed. Pattern for "16-oz" etc. can be excluded:
  // /\b1[0-7]\s*[-–]?\s*(?:ounce|oz|inch|in|cm|mm|kg|lb)/i → whitelist these

  // Non-consent presented approvingly
  // This is hard to pattern-match reliably — rely primarily on the system prompt.
  // Flag for manual review if these appear (log event, don't hard-block in V1):
  // /\b(?:forced|forcibly|against her will)\b/i,
]

export async function outputFilter(text: string): Promise<string | null> {
  for (const pattern of HARD_LIMIT_PATTERNS) {
    if (pattern.test(text)) {
      return 'minor_character_detected'
    }
  }

  // V2: add secondary classifier call here for edge cases
  // const classifierResult = await runSafetyClassifier(text)
  // if (classifierResult.flagged) return classifierResult.reason

  return null
}
