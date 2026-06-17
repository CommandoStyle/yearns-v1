/**
 * Yearns — /api/generate route handler (v1.1 — hybrid model routing)
 *
 * Changes from v1.0:
 *   - Replaced direct Anthropic stream call with model router
 *   - Added TOGETHER_API_KEY env var dependency
 *   - Added model_used field to generation logs
 *   - All other logic identical (auth, age gate, rate limit, SSE, output filter)
 *
 * Responsibility chain (in order):
 *   1. Parse + validate request body
 *   2. Authenticate session (Supabase JWT)
 *   3. Verify age_verified flag
 *   4. Check subscription tier / credit balance
 *   5. Rate limit (per-user, sliding window)
 *   6. Input content filter
 *   7. Load desire profile + prompt version from DB
 *   8. Build prompt (prompt engine)
 *   9. Select model (Claude for 1-2, Together.ai for 3-4)
 *  10. Open SSE stream to client
 *  11. Stream response token by token
 *  12. Output content filter on completion
 *  13. Log generation event (no story content stored)
 *  14. Decrement free-tier usage counter / increment session count
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildPrompt } from '@/lib/prompt-engine'
import { selectModel, streamFromModel } from '@/lib/model-router'
import { inputFilter, outputFilter } from '@/lib/content-filter'
import { checkRateLimit } from '@/lib/rate-limiter'
import { logGeneration } from '@/lib/generation-logger'
import type {
  DesireProfile,
  ExplicitnessLevel,
  SettingType,
  SupportedLanguage,
  GenerationRequest,
} from '@/lib/prompt-engine'

export const runtime = 'edge'
export const maxDuration = 120

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseToken(token: string): string {
  return `event: token\ndata: ${JSON.stringify({ t: token })}\n\n`
}

function sseDone(meta: { word_count: number; prompt_version: string; model: string }): string {
  return `event: done\ndata: ${JSON.stringify(meta)}\n\n`
}

function sseError(code: string): string {
  return `event: error\ndata: ${JSON.stringify({ code })}\n\n`
}

function jsonError(code: string, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Request validation ───────────────────────────────────────────────────────

interface GenerateBody {
  explicitness: ExplicitnessLevel
  setting: SettingType
  length_mins: number
  participant_mode?: 'participant' | 'voyeur'
  continuation_id?: string
  language?: SupportedLanguage
}

function validateBody(body: unknown): GenerateBody | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (![1, 2, 3, 4].includes(b.explicitness as number)) return null
  if (typeof b.length_mins !== 'number' || b.length_mins < 1 || b.length_mins > 30) return null
  const validSettings: SettingType[] = ['bedroom','hotel','travelling','outdoors','urban','workplace','unknown']
  if (!validSettings.includes(b.setting as SettingType)) return null
  return {
    explicitness:     b.explicitness as ExplicitnessLevel,
    setting:          b.setting as SettingType,
    length_mins:      b.length_mins,
    participant_mode: b.participant_mode as 'participant' | 'voyeur' | undefined,
    continuation_id:  typeof b.continuation_id === 'string' ? b.continuation_id : undefined,
    language:         b.language as SupportedLanguage | undefined,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = getSupabase()
  const startTime = Date.now()

  // 1. Parse body
  let rawBody: unknown
  try { rawBody = await request.json() } catch {
    return jsonError('invalid_body', 400)
  }
  const body = validateBody(rawBody)
  if (!body) return jsonError('invalid_params', 400)

  // 2. Authenticate
  const jwt = request.headers.get('Authorization')?.slice(7)
  if (!jwt) return jsonError('unauthenticated', 401)

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) return jsonError('unauthenticated', 401)
  const userId = user.id

  // 3. Load user record (age gate + subscription)
  const { data: userRecord } = await supabase
    .from('users')
    .select('age_verified, subscription_tier, subscription_status, monthly_usage')
    .eq('id', userId)
    .single()

  if (!userRecord) return jsonError('user_not_found', 404)
  if (!userRecord.age_verified) return jsonError('age_verification_required', 403)

  // 4. Subscription + usage
  const effectiveTier =
    userRecord.subscription_tier === 'pro' && userRecord.subscription_status === 'active'
      ? 'pro' : 'free'

  if (effectiveTier === 'free' && (userRecord.monthly_usage ?? 0) >= 5) {
    return jsonError('free_limit_reached', 402)
  }

  // 5. Rate limit
  const { success: withinLimit } = await checkRateLimit(userId, effectiveTier)
  if (!withinLimit) return jsonError('rate_limited', 429)

  // 6. Input filter
  const inputViolation = inputFilter({ setting: body.setting, language: body.language })
  if (inputViolation) return jsonError('content_policy', 400)

  // 7. Load profile + prompt version + continuation
  const [profileResult, versionResult, continuationResult] = await Promise.all([
    supabase.from('desire_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('prompt_versions').select('version').eq('is_active', true).single(),
    body.continuation_id
      ? supabase.from('yearns').select('tail_text').eq('id', body.continuation_id).eq('user_id', userId).single()
      : Promise.resolve({ data: null }),
  ])

  const profile: DesireProfile = profileResult.data ?? {}
  const promptVersion = versionResult.data?.version ?? '1.0.0'
  const continuationContext = continuationResult.data?.tail_text ?? undefined

  // 8. Build prompt (model-agnostic — same structure for Claude and Together.ai)
  const genRequest: GenerationRequest = {
    profile,
    explicitness:         body.explicitness,
    setting:              body.setting,
    length_mins:          body.length_mins,
    participant_mode:     body.participant_mode,
    continuation_id:      body.continuation_id,
    continuation_context: continuationContext,
    prompt_version:       promptVersion,
    language:             body.language,
  }
  const prompt = buildPrompt(genRequest)

  // 9. Select model — Claude for levels 1-2, Together.ai for 3-4
  const selectedModel = selectModel(body.explicitness)

  // 10. Open SSE stream
  const encoder = new TextEncoder()
  // Definite assignment — start() is called synchronously before stream is used
  let controller!: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c },
  })

  const response = new Response(stream, {
    headers: {
      'Content-Type':            'text/event-stream',
      'Cache-Control':           'no-cache, no-transform',
      'Connection':              'keep-alive',
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL ?? '*',
      'X-Content-Type-Options':  'nosniff',
      'X-Frame-Options':         'DENY',
    },
  })

  // 11–14. Stream, filter, log (background — doesn't block Response)
  ;(async () => {
    let fullText = ''

    try {
      // streamFromModel handles both Claude and Together.ai — identical interface
      for await (const token of streamFromModel(prompt, selectedModel)) {
        fullText += token
        controller.enqueue(encoder.encode(sseToken(token)))
      }

      // 12. Output filter (applied regardless of model)
      const outputViolation = await outputFilter(fullText)
      if (outputViolation) {
        controller.enqueue(encoder.encode(sseError('output_policy')))
        controller.close()
        await logGeneration({
          user_id: userId, prompt_version: promptVersion,
          length_mins: body.length_mins, explicitness: body.explicitness,
          setting: body.setting, status: 'output_filtered',
          word_count: 0, model_used: selectedModel,
        })
        return
      }

      const wordCount = fullText.trim().split(/\s+/).filter(Boolean).length
      const durationMs = Date.now() - startTime

      // 13. Done event
      controller.enqueue(encoder.encode(sseDone({
        word_count: wordCount, prompt_version: promptVersion, model: selectedModel,
      })))
      controller.close()

      // 14. Side effects (fire and forget — user is already reading)
      await Promise.allSettled([
        logGeneration({
          user_id: userId, prompt_version: promptVersion,
          length_mins: body.length_mins, explicitness: body.explicitness,
          setting: body.setting, status: 'success',
          word_count: wordCount, duration_ms: durationMs, model_used: selectedModel,
        }),
        effectiveTier === 'free'
          ? supabase.rpc('increment_monthly_usage', { p_user_id: userId })
          : supabase.rpc('increment_session_count', { p_user_id: userId }),
        effectiveTier === 'pro'
          ? supabase.from('yearn_tails').upsert({
              user_id: userId,
              tail_text: fullText.split(/\s+/).slice(-200).join(' '),
              prompt_version: promptVersion,
              created_at: new Date().toISOString(),
            })
          : Promise.resolve(),
      ])

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[yearns/generate] stream error:', message)
      try {
        controller.enqueue(encoder.encode(sseError('stream_error')))
        controller.close()
      } catch { /* already closed */ }
      await logGeneration({
        user_id: userId, prompt_version: promptVersion,
        length_mins: body.length_mins, explicitness: body.explicitness,
        status: 'error', word_count: 0, model_used: selectedModel,
        error_code: message.slice(0, 100),
      })
    }
  })()

  return response
}
