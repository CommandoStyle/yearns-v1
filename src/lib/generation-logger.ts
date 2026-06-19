/**
 * Yearns — Generation logger
 * Writes metadata-only records to generation_logs.
 * NEVER writes story content. Privacy-safe by design.
 */

import { createServerClient } from '@/lib/supabase'
import type { ExplicitnessLevel, SettingType } from '@/lib/prompt-engine'
import type { Json } from '@/types/database'

export interface GenerationLogEntry {
  user_id:              string
  prompt_version:       string
  explicitness:         ExplicitnessLevel
  length_mins:          number
  status:               'success' | 'error' | 'input_filtered' | 'output_filtered' | 'cancelled'
  word_count:           number
  model_used?:          string
  setting?:             SettingType
  language?:            string
  continuation?:        boolean
  duration_ms?:         number
  error_code?:          string
  per_story_overrides?: Record<string, unknown>
}

// Returns the inserted log ID so the generate route can reference it
// for story text upload (trainer storage pipeline).
export async function logGeneration(entry: GenerationLogEntry): Promise<string | null> {
  try {
    const supabase = createServerClient()
    const { data } = await supabase.from('generation_logs').insert({
      user_id:        entry.user_id,
      prompt_version: entry.prompt_version,
      explicitness:   entry.explicitness,
      length_mins:    entry.length_mins,
      status:         entry.status,
      word_count:     entry.word_count,
      model_used:     entry.model_used ?? null,
      setting:        entry.setting,
      language:       entry.language,
      is_continuation:     entry.continuation ?? false,
      duration_ms:         entry.duration_ms,
      error_code:          entry.error_code,
      per_story_overrides: (entry.per_story_overrides ?? {}) as Json,
    }).select('id').single()
    return data?.id ?? null
  } catch (err) {
    // Logging failure must never affect the user experience.
    // Log to console (Sentry will capture) and continue.
    console.error('[yearns/logger] Failed to write generation log:', err)
    return null
  }
}
