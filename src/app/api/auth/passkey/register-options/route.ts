/**
 * GET /api/auth/passkey/register-options
 * Returns WebAuthn registration options for the authenticated user.
 * Must use nodejs runtime — @simplewebauthn/server requires Web Crypto.
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { buildRegistrationOptions } from '@/lib/webauthn-server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const options = await buildRegistrationOptions(session.user.id, session.user.email!)
    return NextResponse.json(options)
  } catch (err) {
    console.error('[yearns/passkey/register-options]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
