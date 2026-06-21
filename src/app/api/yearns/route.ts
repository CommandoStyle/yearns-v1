import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function jsonError(code: string, status: number) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Derive a title from the opening sentence of the story.
// Caps at 80 chars with ellipsis to match the yearns.title column.
function deriveTitle(text: string): string {
  const first = text.trim().split(/[.!?]/)[0]?.trim() ?? ''
  if (!first) return 'Untitled Yearn'
  return first.length <= 80 ? first : first.slice(0, 77) + '…'
}

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = getSupabase()

  // Auth
  const jwt = request.headers.get('Authorization')?.slice(7)
  if (!jwt) return jsonError('unauthenticated', 401)

  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !user) return jsonError('unauthenticated', 401)
  const userId = user.id

  // Subscription gate — saves are Pro only
  const { data: userRecord } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status')
    .eq('id', userId)
    .single()

  const isPro = userRecord?.subscription_tier === 'pro'
             && userRecord?.subscription_status === 'active'

  if (!isPro) return jsonError('pro_required', 402)

  // Parse body
  let body: {
    text: string
    setting?: string
    explicitness?: number
    length_mins?: number
    word_count?: number
    prompt_version?: string
    language?: string
  }
  try { body = await request.json() } catch { return jsonError('invalid_body', 400) }
  if (!body.text || typeof body.text !== 'string') return jsonError('invalid_body', 400)

  const title = deriveTitle(body.text)

  // Insert metadata row
  const { data: yearn, error: insertError } = await supabase
    .from('yearns')
    .insert({
      user_id:        userId,
      title,
      setting:        body.setting,
      explicitness:   body.explicitness,
      length_mins:    body.length_mins,
      word_count:     body.word_count,
      prompt_version: body.prompt_version,
      language:       body.language ?? 'en',
      is_saved:       true,
    })
    .select('id')
    .single()

  if (insertError || !yearn) {
    console.error('[yearns/save] insert error:', insertError?.message)
    return jsonError('save_failed', 500)
  }

  // Upload story text to Storage — yearns/{user_id}/{yearn_id}.txt
  const path = `${userId}/${yearn.id}.txt`
  const { error: storageError } = await supabase.storage
    .from('yearns')
    .upload(path, new Blob([body.text], { type: 'text/plain' }), {
      cacheControl: '3600',
      upsert: false,
    })

  if (storageError) {
    // Storage failed — roll back the metadata row so there's no orphan
    await supabase.from('yearns').delete().eq('id', yearn.id)
    console.error('[yearns/save] storage error:', storageError.message)
    return jsonError('save_failed', 500)
  }

  return new Response(JSON.stringify({ id: yearn.id, title }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
