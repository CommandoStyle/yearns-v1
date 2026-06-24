// Cast characters API — GET (list) · POST (create) · PATCH (update) · DELETE
// All operations are scoped to the authenticated user via RLS + explicit filter.

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// cast_characters is not yet in the generated Database types (migration 0010
// must be applied and types regenerated). Using untyped client here until then.

export const runtime = 'edge'

const CAST_SOFT_CAP = 8  // max non-self cast members

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): ReturnType<typeof createClient<any>> {
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

// GET /api/cast — returns all cast members for the user
export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const { data, error } = await auth.supabase
    .from('cast_characters')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: 'fetch_failed' }, { status: 500 })
  return Response.json({ cast: data ?? [] })
}

// POST /api/cast — create a new cast member (or upsert the self row)
export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const isSelf = body.is_self === true

  if (!isSelf) {
    // Soft cap check — count existing non-self members
    const { count } = await auth.supabase
      .from('cast_characters')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('is_self', false)

    if ((count ?? 0) >= CAST_SOFT_CAP) {
      return Response.json({ error: 'cast_full', limit: CAST_SOFT_CAP }, { status: 422 })
    }
  }

  const row = {
    user_id:           auth.user.id,
    is_self:           isSelf,
    name:              (body.name as string)              || null,
    gender:            (body.gender as string)            || null,
    role:              (body.role as string)              || null,
    traits:            (body.traits as string[])          || null,
    hair_colour:       (body.hair_colour as string)       || null,
    eye_colour:        (body.eye_colour as string)        || null,
    build:             (body.build as string)             || null,
    height:            (body.height as string)            || null,
    additional_detail: ((body.additional_detail as string) || '').slice(0, 300) || null,
  }

  if (isSelf) {
    // Upsert the self row — partial unique index ensures at most one per user.
    // On conflict (user already has a self row) update in place.
    const { data, error } = await auth.supabase
      .from('cast_characters')
      .upsert(row, { onConflict: 'user_id', ignoreDuplicates: false })
      .select()
      .single()
    if (error) return Response.json({ error: 'save_failed' }, { status: 500 })
    return Response.json({ character: data })
  }

  const { data, error } = await auth.supabase
    .from('cast_characters')
    .insert(row)
    .select()
    .single()

  if (error) return Response.json({ error: 'save_failed' }, { status: 500 })
  return Response.json({ character: data }, { status: 201 })
}

// PATCH /api/cast?id=<uuid> — update a cast member
export async function PATCH(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'missing_id' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if ('name'              in body) patch.name              = (body.name as string)              || null
  if ('gender'            in body) patch.gender            = (body.gender as string)            || null
  if ('role'              in body) patch.role              = (body.role as string)              || null
  if ('traits'            in body) patch.traits            = (body.traits as string[])          || null
  if ('hair_colour'       in body) patch.hair_colour       = (body.hair_colour as string)       || null
  if ('eye_colour'        in body) patch.eye_colour        = (body.eye_colour as string)        || null
  if ('build'             in body) patch.build             = (body.build as string)             || null
  if ('height'            in body) patch.height            = (body.height as string)            || null
  if ('additional_detail' in body) patch.additional_detail = ((body.additional_detail as string) || '').slice(0, 300) || null

  const { data, error } = await auth.supabase
    .from('cast_characters')
    .update(patch)
    .eq('id', id)
    .eq('user_id', auth.user.id)  // belt-and-suspenders alongside RLS
    .select()
    .single()

  if (error) return Response.json({ error: 'update_failed' }, { status: 500 })
  return Response.json({ character: data })
}

// DELETE /api/cast?id=<uuid> — delete a non-self cast member
export async function DELETE(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'missing_id' }, { status: 400 })

  // Cannot delete the self row via this endpoint — use PATCH to clear fields
  const { data: existing } = await auth.supabase
    .from('cast_characters')
    .select('is_self')
    .eq('id', id)
    .eq('user_id', auth.user.id)
    .single()

  if (existing?.is_self) {
    return Response.json({ error: 'cannot_delete_self_row' }, { status: 422 })
  }

  const { error } = await auth.supabase
    .from('cast_characters')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.user.id)

  if (error) return Response.json({ error: 'delete_failed' }, { status: 500 })
  return new Response(null, { status: 204 })
}
