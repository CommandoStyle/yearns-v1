/**
 * POST /api/auth/reset-password
 * Sends a password reset email via Supabase Auth.
 * Returns 200 regardless of whether the email exists (prevents user enumeration).
 */

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string }
    if (!email) {
      return NextResponse.json({ error: 'email_required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Redirect URL must be listed in Supabase Auth → URL Configuration → Redirect URLs
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/update-password`,
    })

    // Always 200 to avoid user enumeration
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[yearns/reset-password]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
