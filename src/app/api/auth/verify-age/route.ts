/**
 * POST /api/auth/verify-age
 * Temporary self-declaration age gate for pre-launch testing.
 * Sets age_verified = true on the authenticated user's row.
 *
 * Will be replaced by Veriff webhook (which sets age_verified server-side
 * after identity document verification). This route will be removed at that point.
 */

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    // Read JWT from Authorization header (same pattern as all other routes).
    // createServerClient().getSession() doesn't work on edge — no cookies.
    const jwt = req.headers.get('Authorization')?.slice(7)
    if (!jwt) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const admin = getAdmin()
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt)
    if (authError || !user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const { error } = await admin
      .from('users')
      .update({
        age_verified:        true,
        age_verified_at:     new Date().toISOString(),
        age_verified_method: 'self_declaration_temp',
      })
      .eq('id', user.id)

    if (error) {
      console.error('[yearns/verify-age] update error:', error)
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[yearns/verify-age] unexpected error:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
