/**
 * GET  /api/admin/originality          → list originality_flags (paginated)
 * PATCH /api/admin/originality/[id]    → update status (reviewed_ok | reviewed_concern)
 *
 * Admin-only. Enforced via middleware role check (same TRAINER_PREFIXES pattern
 * but scoped to /api/admin — add /admin to TRAINER_PREFIXES or add a separate
 * ADMIN_PREFIXES check in middleware). For V1 the trainer middleware check
 * already gates /trainer routes; for /admin routes add middleware gating as needed.
 *
 * Uses service role to bypass RLS (originality_flags has no user-facing policy).
 */

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function requireAdmin(request: NextRequest) {
  // Middleware injects x-trainer-role for trainer/admin routes.
  // If this route is added to ADMIN_PREFIXES in middleware, this header will be set.
  const role = request.headers.get('x-trainer-role')
  if (role !== 'admin') return false
  return true
}

// ─── GET — list flags ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'pending_review'
  const page   = parseInt(searchParams.get('page') ?? '1', 10)
  const limit  = 25
  const offset = (page - 1) * limit

  const supabase = getSupabase()

  const { data, error, count } = await supabase
    .from('originality_flags')
    .select(`
      id,
      yearn_id,
      story_id,
      result,
      status,
      reviewed_by,
      reviewed_at,
      created_at
    `, { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('[admin/originality] GET error:', error)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
  }

  return NextResponse.json({ flags: data ?? [], total: count ?? 0, page, limit })
}

// ─── PATCH — update flag status ───────────────────────────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const adminId = request.headers.get('x-trainer-id')
  if (!adminId) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null) as {
    id:     string
    status: 'reviewed_ok' | 'reviewed_concern'
  } | null

  if (!body?.id || !['reviewed_ok', 'reviewed_concern'].includes(body.status)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { error } = await supabase
    .from('originality_flags')
    .update({
      status:      body.status,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', body.id)

  if (error) {
    console.error('[admin/originality] PATCH error:', error)
    return NextResponse.json({ error: 'update_failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
