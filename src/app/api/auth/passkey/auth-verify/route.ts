/**
 * POST /api/auth/passkey/auth-verify
 * Verifies the WebAuthn authentication response and returns a session token
 * the client can use to establish a Supabase session.
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import type { AuthenticationResponseJSON } from '@simplewebauthn/server'
import { createClient } from '@supabase/supabase-js'
import { verifyAuthentication } from '@/lib/webauthn-server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { response: AuthenticationResponseJSON }

    const { userId } = await verifyAuthentication(body.response)

    // Generate a magic-link token for this user so the client can call
    // supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) to get a session.
    const supabase = adminClient()
    const { data: { user } } = await supabase.auth.admin.getUserById(userId)
    if (!user?.email) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type:  'magiclink',
      email: user.email,
    })

    if (linkError || !linkData.properties.hashed_token) {
      console.error('[yearns/passkey/auth-verify] generateLink error:', linkError)
      return NextResponse.json({ error: 'session_creation_failed' }, { status: 500 })
    }

    return NextResponse.json({
      verified:    true,
      token_hash:  linkData.properties.hashed_token,
      email:       user.email,
    })
  } catch (err) {
    console.error('[yearns/passkey/auth-verify]', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: 'verification_failed', detail: msg }, { status: 400 })
  }
}
