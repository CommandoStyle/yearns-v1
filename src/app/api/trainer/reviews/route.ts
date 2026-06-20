/**
 * Yearns — /api/trainer/reviews route handler
 *
 * GET  /api/trainer/reviews/queue    → next story from queue
 * POST /api/trainer/reviews          → submit a completed review
 * GET  /api/trainer/reviews/stats    → session + aggregate stats
 *
 * Auth: trainer role required (enforced by middleware before this runs).
 * Trainer ID is injected by middleware via x-trainer-id header.
 *
 * All routes use the service role Supabase client because:
 *   1. We need cross-table writes (trainer_reviews + story_queue)
 *   2. Middleware has already verified the trainer's identity and role
 *   3. All writes are scoped to the trainer's own ID in the application layer
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import {
  validateSubmission,
  SCORE_DIMENSIONS,
  type QueueItem,
  type ReviewSubmissionResponse,
  type SessionStats,
  type ReviewStats,
} from '@/types/trainer'
import { checkAgainstGoldCorpus, type SimilarityResult } from '@/lib/originality-check'

export const runtime = 'edge'

// ─── Supabase (service role — trainer identity verified by middleware) ─────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ─── GET /api/trainer/reviews ─────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const trainerId = request.headers.get('x-trainer-id')
  if (!trainerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? 'queue'

  if (action === 'stats') return getStats(request, trainerId)

  return getQueue(trainerId)
}

async function getQueue(trainerId: string): Promise<NextResponse> {
  const supabase = getSupabase()

  // Call the DB function that returns prioritised, unreviewed stories
  const { data: queueItems, error } = await supabase
    .rpc('get_trainer_queue', { p_trainer_id: trainerId, p_limit: 1 })

  if (error) {
    console.error('[trainer/queue] DB error:', error)
    return NextResponse.json({ error: 'queue_error' }, { status: 500 })
  }

  if (!queueItems || queueItems.length === 0) {
    return NextResponse.json({ story: null, queue_empty: true })
  }

  const item = queueItems[0]

  // Fetch story text from Supabase Storage
  // Stories are stored at: trainer-stories/{story_id}.txt
  const { data: storyFile } = await supabase.storage
    .from('trainer-stories')
    .download(`${item.story_id}.txt`)

  let storyText = ''
  if (storyFile) {
    storyText = await storyFile.text()
  }

  // Mark as in_progress in the queue
  await supabase
    .from('story_queue')
    .update({
      status: 'in_progress',
      trainer_id: trainerId,
      assigned_at: new Date().toISOString(),
    })
    .eq('id', item.queue_id)
    .is('trainer_id', null)  // only claim unassigned items

  const story: QueueItem = {
    queue_id:      item.queue_id,
    story_id:      item.story_id,
    blind_review:  item.blind_review,
    priority:      item.priority,
    story_text:    storyText,
    explicitness:  item.explicitness,
    language:      item.language,
    length_mins:   item.length_mins,
    prompt_version: item.prompt_version ?? undefined,
    model_used:    item.model_used ?? undefined,
  }

  return NextResponse.json({ story })
}

// ─── POST /api/trainer/reviews ────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const trainerId = request.headers.get('x-trainer-id')
  if (!trainerId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Parse and validate body
  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const submission = validateSubmission(rawBody)
  if (!submission) {
    return NextResponse.json({ error: 'invalid_submission' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Verify the story belongs to the trainer's queue
  const { data: queueItem } = await supabase
    .from('story_queue')
    .select('id, story_id, blind_review')
    .eq('id', submission.queue_id)
    .eq('story_id', submission.story_id)
    .single()

  if (!queueItem) {
    return NextResponse.json({ error: 'story_not_in_queue' }, { status: 404 })
  }

  // Fetch generation_logs context for denormalisation
  const { data: logEntry } = await supabase
    .from('generation_logs')
    .select('prompt_version, model_used, explicitness, language')
    .eq('id', submission.story_id)
    .single()

  // Compute avg_score in application layer as backup
  const scoreValues = SCORE_DIMENSIONS.map((d) => submission.scores[d.key])
  const avgScore = scoreValues.reduce((a: number, b: number) => a + b, 0) / scoreValues.length

  // Auto-determine corpus_tag if trainer left it null
  // Gold = avg >= 4.0 AND reread = true
  let corpusTag = submission.corpus_tag
  if (!corpusTag) {
    corpusTag = (avgScore >= 4.0 && submission.reread) ? 'gold' : null
  }

  // ── N-gram similarity check (gold corpus) ────────────────────────────────────
  // Run when gold tag is being assigned. Non-blocking — warnings surface to the
  // trainer but do NOT auto-reject. Human makes the final call.
  let similarityResult: SimilarityResult | null = null
  let goldSimilarityWarning: { storyId: string; score: number } | null = null

  if (corpusTag === 'gold') {
    try {
      // Fetch current story text from Storage
      const { data: thisFile } = await supabase.storage
        .from('trainer-stories')
        .download(`${submission.story_id}.txt`)

      if (thisFile) {
        const thisText = await thisFile.text()

        // List existing gold stories to compare against
        const { data: goldReviews } = await supabase
          .from('trainer_reviews')
          .select('story_id')
          .eq('corpus_tag', 'gold')
          .neq('story_id', submission.story_id)

        const goldTexts: Array<{ story_id: string; text: string }> = []
        await Promise.all(
          (goldReviews ?? []).map(async (r) => {
            const { data: f } = await supabase.storage
              .from('trainer-stories')
              .download(`${r.story_id}.txt`)
            if (f) goldTexts.push({ story_id: r.story_id, text: await f.text() })
          })
        )

        if (goldTexts.length > 0) {
          similarityResult = checkAgainstGoldCorpus(thisText, goldTexts)
          if (similarityResult.flagged && similarityResult.matchedStoryId) {
            goldSimilarityWarning = {
              storyId: similarityResult.matchedStoryId,
              score:   similarityResult.maxSimilarity,
            }
          }
        }
      }
    } catch (err) {
      // Similarity check failure must never block the review submission
      console.error('[trainer/reviews] Similarity check error (non-fatal):', err)
    }
  }

  // Upsert the review (trainer can revise a submission in the same session)
  const { data: review, error: reviewError } = await supabase
    .from('trainer_reviews')
    .upsert({
      story_id:       submission.story_id,
      trainer_id:     trainerId,
      scores:         submission.scores,
      reread:         submission.reread,
      failure_codes:  submission.failure_codes,
      corpus_tag:     corpusTag,
      annotations:    submission.annotations,
      notes:          submission.notes,
      // Denormalised context
      prompt_version: logEntry?.prompt_version ?? null,
      model_used:     logEntry?.model_used ?? null,
      explicitness:   logEntry?.explicitness ?? null,
      language:       logEntry?.language ?? null,
      // Similarity check result (null if not a gold submission or no corpus yet)
      similarity_check: similarityResult
        ? {
            max_similarity:    similarityResult.maxSimilarity,
            matched_story_id:  similarityResult.matchedStoryId,
            flagged:           similarityResult.flagged,
            checked_at:        similarityResult.checkedAt,
          }
        : null,
    }, {
      onConflict: 'story_id,trainer_id',
      ignoreDuplicates: false,  // allow updates
    })
    .select('id')
    .single()

  if (reviewError) {
    console.error('[trainer/reviews] Upsert error:', reviewError)
    return NextResponse.json({ error: 'review_save_failed' }, { status: 500 })
  }

  // Update queue status to reviewed
  await supabase
    .from('story_queue')
    .update({
      status: 'reviewed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', submission.queue_id)

  // If gold: update prompt version stats async (fire-and-forget)
  if (corpusTag === 'gold' && logEntry?.prompt_version) {
    void supabase.rpc('update_prompt_version_stats', {
      p_version: logEntry.prompt_version,
    })
  }

  // Pre-load next story for seamless UX
  const nextQueue = await getQueue(trainerId)
  const nextData = await nextQueue.json() as { story: QueueItem | null }

  // Compute session stats
  const stats = await computeSessionStats(trainerId, supabase)

  const response: ReviewSubmissionResponse & {
    gold_similarity_warning?: { storyId: string; score: number }
  } = {
    review_id:    review!.id,
    next_story:   nextData.story ?? null,
    session_stats: stats,
    ...(goldSimilarityWarning && { gold_similarity_warning: goldSimilarityWarning }),
  }

  return NextResponse.json(response)
}

// ─── GET /api/trainer/reviews?action=stats ────────────────────────────────────

async function getStats(
  request: NextRequest,
  trainerId: string,
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const promptVersion = searchParams.get('prompt_version') ?? undefined
  const modelUsed     = searchParams.get('model_used') ?? undefined
  const language      = searchParams.get('language') ?? undefined

  const supabase = getSupabase()

  const { data: aggStats, error } = await supabase
    .rpc('get_review_stats', {
      p_prompt_version: promptVersion ?? null,
      p_model_used:     modelUsed     ?? null,
      p_language:       language      ?? null,
    })
    .single()

  if (error) {
    return NextResponse.json({ error: 'stats_error' }, { status: 500 })
  }

  const sessionStats = await computeSessionStats(trainerId, supabase)

  return NextResponse.json({
    aggregate: aggStats as ReviewStats,
    session:   sessionStats,
  })
}

// ─── Session stats helper ─────────────────────────────────────────────────────

async function computeSessionStats(
  trainerId: string,
  supabase: ReturnType<typeof getSupabase>,
): Promise<SessionStats> {
  const sessionStart = new Date()
  sessionStart.setHours(sessionStart.getHours() - 4) // "session" = last 4 hours

  const [reviewsResult, queueResult] = await Promise.all([
    supabase
      .from('trainer_reviews')
      .select('avg_score, corpus_tag, failure_codes, reread')
      .eq('trainer_id', trainerId)
      .gte('submitted_at', sessionStart.toISOString()),

    supabase
      .from('story_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  const reviews = reviewsResult.data ?? []
  const totalInQueue = queueResult.count ?? 0

  const avgScoreSession = reviews.length
    ? reviews.reduce((sum, r) => sum + (Number(r.avg_score) || 0), 0) / reviews.length
    : 0

  // Find most common failure code this session
  const failureCounts: Record<string, number> = {}
  for (const r of reviews) {
    for (const code of (r.failure_codes ?? [])) {
      failureCounts[code] = (failureCounts[code] ?? 0) + 1
    }
  }
  const topFailure = Object.entries(failureCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

  return {
    reviewed_today:           reviews.length,
    total_in_queue:           totalInQueue,
    gold_this_session:        reviews.filter(r => r.corpus_tag === 'gold').length,
    avg_score_this_session:   Math.round(avgScoreSession * 10) / 10,
    top_failure_this_session: topFailure as SessionStats['top_failure_this_session'],
  }
}
