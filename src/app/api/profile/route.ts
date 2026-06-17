import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

export const runtime = 'edge'

function getSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function authenticate(request: NextRequest) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const supabase = getSupabase()
  const { data: { user }, error } = await supabase.auth.getUser(header.slice(7))
  if (error || !user) return null
  return { user, supabase }
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await auth.supabase
    .from('desire_profiles')
    .select('*')
    .eq('user_id', auth.user.id)
    .single()

  // PGRST116 = row not found — new user with no profile yet
  if (error && error.code !== 'PGRST116') {
    return Response.json({ error: 'fetch_failed' }, { status: 500 })
  }

  return Response.json({ profile: data ?? null })
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const userId = auth.user.id

  const { data: profile, error } = await auth.supabase.rpc('upsert_desire_profile', {
    p_user_id:               userId,
    p_display_name:          (body.display_name as string)           ?? null,
    p_genre_weights:         (body.genre_weights as Json)             ?? null,
    p_emotional_register:    (body.emotional_register as string[])   ?? null,
    p_desire_targets:        (body.desire_targets as string)         ?? null,
    p_explicitness_default:  (body.explicitness_default as number)   ?? null,
    p_participant_mode:      (body.participant_mode as string)       ?? null,
    p_hard_limits:           (body.hard_limits as string[])          ?? null,
    p_three_words:           (body.three_words as string[])          ?? null,
    p_style_references:      (body.style_references as string[])     ?? null,
    p_setting_preference:    (body.setting_preference as Json)        ?? null,
    p_language:              (body.language as string)               ?? null,
  })

  if (error) {
    console.error('[yearns/profile] upsert_desire_profile failed:', error)
    return Response.json({ error: 'update_failed' }, { status: 500 })
  }

  if (body.onboarding_complete === true) {
    await auth.supabase
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', userId)
  }

  return Response.json({ profile })
}
