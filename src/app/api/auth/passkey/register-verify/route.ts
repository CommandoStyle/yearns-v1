/**
 * POST /api/auth/passkey/register-verify
 * Verifies a WebAuthn registration response and stores the credential.
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import type { RegistrationResponseJSON } from '@simplewebauthn/server'
import { createServerClient } from '@/lib/supabase'
import { verifyRegistration } from '@/lib/webauthn-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const body = await req.json() as { response: RegistrationResponseJSON; deviceLabel?: string }

    await verifyRegistration(session.user.id, body.response, body.deviceLabel ?? null)

    return NextResponse.json({ verified: true })
  } catch (err) {
    console.error('[yearns/passkey/register-verify]', err)
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: 'verification_failed', detail: msg }, { status: 400 })
  }
}
