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
import { createServerClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is authenticated
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    // Use service role to write age_verified — the users table may have RLS
    // that prevents self-updates to this column (it's set by Veriff webhook, not the user)
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await admin
      .from('users')
      .update({
        age_verified:        true,
        age_verified_at:     new Date().toISOString(),
        age_verified_method: 'self_declaration_temp',
      })
      .eq('id', session.user.id)

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
