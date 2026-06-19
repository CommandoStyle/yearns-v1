/**
 * POST /api/auth/passkey/auth-options
 * Returns WebAuthn authentication options.
 * Accepts optional { email } body to scope credential hints to a known user.
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildAuthenticationOptions } from '@/lib/webauthn-server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { email?: string }

    let userId: string | undefined

    if (body.email) {
      // Look up user so we can scope allowCredentials to their passkeys.
      // This hints the authenticator but does NOT authenticate yet.
      const { data } = await adminClient().auth.admin.listUsers()
      const user = data?.users?.find(u => u.email === body.email)
      userId = user?.id
    }

    const options = await buildAuthenticationOptions(userId)
    return NextResponse.json(options)
  } catch (err) {
    console.error('[yearns/passkey/auth-options]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
