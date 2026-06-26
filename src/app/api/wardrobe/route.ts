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
    .from('wardrobe_items')
    .select('id, description')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: 'fetch_failed' }, { status: 500 })
  return Response.json({ items: data ?? [] })
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (!description) return Response.json({ error: 'description_required' }, { status: 400 })
  if (description.length > 120) return Response.json({ error: 'description_too_long' }, { status: 400 })

  const { data, error } = await auth.supabase
    .from('wardrobe_items')
    .insert({ user_id: auth.user.id, description })
    .select('id, description')
    .single()

  if (error) return Response.json({ error: 'insert_failed' }, { status: 500 })
  return Response.json({ item: data })
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return Response.json({ error: 'id_required' }, { status: 400 })

  const { error } = await auth.supabase
    .from('wardrobe_items')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (error) return Response.json({ error: 'delete_failed' }, { status: 500 })
  return Response.json({ ok: true })
}
