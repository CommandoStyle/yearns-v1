import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'edge'

export async function POST(request: NextRequest): Promise<Response> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) {
    // Signal loss is acceptable — fail silently
    return new Response(null, { status: 204 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(header.slice(7))
  if (authError || !user) return new Response(null, { status: 204 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(null, { status: 204 })
  }

  const event = body.event as string
  const data  = (body.data as Record<string, unknown>) ?? {}

  if (!event) return new Response(null, { status: 204 })

  // Fire-and-forget — signal loss is acceptable
  try {
    await supabase.from('implicit_signals').insert({
      user_id:    user.id,
      event_type: event,
      event_data: data as import('@/types/database').Json,
    })
  } catch { /* acceptable */ }

  return new Response(null, { status: 204 })
}
