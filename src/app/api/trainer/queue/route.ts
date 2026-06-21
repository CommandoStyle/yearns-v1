/**
 * Yearns — /api/trainer/queue/populate route
 * Admin-only endpoint to pull stories from generation_logs into story_queue.
 *
 * POST /api/trainer/queue/populate
 *   body: { limit?: number, prompt_version?: string, model_used?: string }
 *
 * Selects recent successful generations that haven't been queued yet,
 * and inserts them into story_queue for trainer review.
 *
 * Also handles writing story text to Supabase Storage (trainer-stories bucket)
 * so the queue endpoint can serve it.
 *
 * In production: run this as a scheduled Edge Function (daily or after each
 * prompt version deployment) rather than a manual API call.
 * For V1: call manually from the admin dashboard after each generation batch.
 *
 * Auth: admin role required. Middleware enforces this.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export const runtime = 'edge'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const trainerRole = request.headers.get('x-trainer-role')
  if (trainerRole !== 'admin') {
    return NextResponse.json({ error: 'admin_only' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body is fine */ }

  const limit         = typeof body.limit === 'number' ? Math.min(body.limit, 100) : 50
  const promptVersion = typeof body.prompt_version === 'string' ? body.prompt_version : null
  const modelUsed     = typeof body.model_used === 'string' ? body.model_used : null
  const blindReview   = body.blind_review !== false  // default true

  const supabase = getSupabase()

  // Get IDs already in the queue so we can exclude them
  const { data: alreadyQueued } = await supabase
    .from('story_queue')
    .select('story_id')

  const excludeIds = (alreadyQueued ?? []).map(r => r.story_id as string)

  // Find recent successful generations not yet in the queue
  let query = supabase
    .from('generation_logs')
    .select('id, prompt_version, model_used, explicitness, language, length_mins')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(limit + excludeIds.length) // over-fetch so we have enough after filtering

  if (promptVersion) query = query.eq('prompt_version', promptVersion)
  if (modelUsed)     query = query.eq('model_used', modelUsed)

  const { data: allLogs, error: logsError } = await query

  if (logsError) {
    return NextResponse.json({ error: 'query_failed', detail: logsError.message }, { status: 500 })
  }

  const logs = (allLogs ?? [])
    .filter(l => !excludeIds.includes(l.id))
    .slice(0, limit)

  if (!logs || logs.length === 0) {
    return NextResponse.json({ queued: 0, message: 'No new stories to queue' })
  }

  // Insert into story_queue
  // Priority: level 3-4 stories get higher priority (more need for review)
  const queueEntries = logs.map(log => ({
    story_id:     log.id,
    blind_review: blindReview,
    status:       'pending',
    priority:     log.explicitness >= 3 ? 10 : 5,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('story_queue')
    .insert(queueEntries)
    .select('id')

  if (insertError) {
    return NextResponse.json({ error: 'insert_failed', detail: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    queued:  inserted?.length ?? 0,
    stories: logs.map(l => ({ id: l.id, model: l.model_used, level: l.explicitness })),
  })
}

/**
 * NOTE ON STORY TEXT STORAGE:
 *
 * The generation pipeline needs to write story text to Supabase Storage
 * when a story is generated, so trainers can retrieve it later.
 *
 * Add this to /src/app/api/generate/route.ts, inside the post-generation
 * side effects block (Promise.allSettled), after the generation completes:
 *
 * ```typescript
 * // Write story text to trainer storage (for blind review queue)
 * // Only write for level 3-4 stories (Claude handles 1-2 and is already good)
 * body.explicitness >= 3
 *   ? supabase.storage
 *       .from('trainer-stories')
 *       .upload(`${generationLogId}.txt`, fullText, {
 *         contentType: 'text/plain',
 *         upsert: true,
 *       })
 *   : Promise.resolve(),
 * ```
 *
 * The `generationLogId` is the UUID returned from the generation_logs insert.
 * Update logGeneration() to return the inserted ID for this purpose.
 *
 * Supabase Storage bucket setup:
 * - Bucket name: 'trainer-stories'
 * - Access: private (no public URL)
 * - RLS: service role only (trainers access via signed URL in queue endpoint)
 */
