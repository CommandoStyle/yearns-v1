/**
 * Yearns — Trainer system types
 * Shared across API routes, page components, and hooks.
 */

// ─── Score dimensions ─────────────────────────────────────────────────────────

export const SCORE_DIMENSIONS = [
  { key: 'arousal_curve',     label: 'Arousal curve' },
  { key: 'female_desire',     label: 'Female desire' },
  { key: 'character_depth',   label: 'Character depth' },
  { key: 'prose_quality',     label: 'Prose quality' },
  { key: 'sensory_detail',    label: 'Sensory detail' },
  { key: 'profile_fidelity',  label: 'Profile fidelity' },
  { key: 'pacing',            label: 'Pacing' },
] as const

export type DimensionKey = typeof SCORE_DIMENSIONS[number]['key']

export type DimensionScores = Record<DimensionKey, number>  // 1–5 each

// ─── Failure taxonomy ─────────────────────────────────────────────────────────

export const FAILURE_CODES = [
  { code: 'perspective_drift',   label: 'Perspective drift',   description: 'Leaves the protagonist\'s POV mid-scene' },
  { code: 'cliche_vocab',        label: 'Cliché vocab',        description: 'Blacklisted phrases or stock erotica language' },
  { code: 'emotional_flatness',  label: 'Emotional flatness',  description: 'Physical without psychological interiority' },
  { code: 'rushed_to_explicit',  label: 'Rushed to explicit',  description: 'Skips tension build, arrives at act too quickly' },
  { code: 'generic_character',   label: 'Generic character',   description: 'Types not people — no specific distinguishing detail' },
  { code: 'repetition',          label: 'Repetition',          description: 'Same phrases, sentence structures, or beats repeated' },
  { code: 'meta_commentary',     label: 'Meta-commentary',     description: 'Narrator announces or summarises instead of showing' },
  { code: 'rhythm_flat',         label: 'Rhythm flat',         description: 'Every sentence the same length and weight' },
  { code: 'abrupt_ending',       label: 'Abrupt ending',       description: 'Story ends without landing — rushed or incomplete' },
] as const

export type FailureCode = typeof FAILURE_CODES[number]['code']

// ─── Corpus tags ──────────────────────────────────────────────────────────────

export type CorpusTag = 'gold' | 'discard' | 'regen' | null

// ─── Annotations ──────────────────────────────────────────────────────────────

export type AnnotationType = 'gold' | 'flag' | 'comment'

export interface Annotation {
  id: string             // client-generated UUID
  type: AnnotationType
  start: number          // character offset in story text
  end: number            // character offset
  text: string           // the selected text span
  comment?: string       // optional note (all types)
  failure_code?: FailureCode  // for flag type only
}

// ─── Queue item (what the trainer sees) ──────────────────────────────────────

export interface QueueItem {
  queue_id: string
  story_id: string
  blind_review: boolean
  priority: number
  story_text: string     // fetched from Supabase Storage
  explicitness: 1 | 2 | 3 | 4
  language: 'en' | 'fr' | 'it' | 'ja'
  length_mins: number
  // Only present when blind_review = false (after submission)
  prompt_version?: string
  model_used?: 'CLAUDE' | 'LLAMA_70B' | 'MIXTRAL'
}

// ─── Review submission ────────────────────────────────────────────────────────

export interface ReviewSubmission {
  story_id: string
  queue_id: string
  scores: DimensionScores
  reread: boolean
  failure_codes: FailureCode[]
  corpus_tag: CorpusTag
  annotations: Annotation[]
  notes: string
}

export interface ReviewSubmissionResponse {
  review_id: string
  next_story: QueueItem | null   // pre-loaded next story for UX continuity
  session_stats: SessionStats
}

// ─── Session state ────────────────────────────────────────────────────────────

export interface SessionStats {
  reviewed_today: number
  total_in_queue: number
  gold_this_session: number
  avg_score_this_session: number
  top_failure_this_session: FailureCode | null
}

// ─── Admin analytics ──────────────────────────────────────────────────────────

export interface ReviewStats {
  total_reviews: number
  avg_score: number
  gold_count: number
  discard_count: number
  regen_count: number
  reread_rate: number
  top_failure_code: FailureCode | null
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateSubmission(body: unknown): ReviewSubmission | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  if (typeof b.story_id !== 'string') return null
  if (typeof b.queue_id !== 'string') return null
  if (typeof b.reread !== 'boolean') return null
  if (!b.scores || typeof b.scores !== 'object') return null

  // Validate all 7 dimensions are present and in range
  const scores = b.scores as Record<string, unknown>
  for (const dim of SCORE_DIMENSIONS) {
    const val = scores[dim.key]
    if (typeof val !== 'number' || val < 1 || val > 5 || !Number.isInteger(val)) {
      return null
    }
  }

  // Validate failure codes are from the taxonomy
  const validCodes = FAILURE_CODES.map(f => f.code)
  const failure_codes = (b.failure_codes as string[] | undefined) ?? []
  if (!Array.isArray(failure_codes)) return null
  if (failure_codes.some(c => !validCodes.includes(c as FailureCode))) return null

  // Validate corpus tag
  const corpus_tag = b.corpus_tag ?? null
  if (corpus_tag !== null && !['gold', 'discard', 'regen'].includes(corpus_tag as string)) {
    return null
  }

  // Validate annotations (basic shape check — deep validation in route handler)
  const annotations = (b.annotations as unknown[] | undefined) ?? []
  if (!Array.isArray(annotations)) return null

  return {
    story_id:      b.story_id as string,
    queue_id:      b.queue_id as string,
    scores:        scores as DimensionScores,
    reread:        b.reread as boolean,
    failure_codes: failure_codes as FailureCode[],
    corpus_tag:    corpus_tag as CorpusTag,
    annotations:   annotations as Annotation[],
    notes:         typeof b.notes === 'string' ? b.notes.slice(0, 2000) : '',
  }
}
