/**
 * POST /api/auth/signup
 * Creates a user with email + password, bypassing email confirmation.
 * Uses admin API so we can set email_confirm: true immediately.
 * Client then calls supabase.auth.signInWithPassword() to get a session.
 */

export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email?: string; password?: string }

    if (!email || !password) {
      return NextResponse.json({ error: 'email_and_password_required' }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'password_too_short' }, { status: 400 })
    }

    const supabase = adminClient()

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip confirmation email
    })

    if (error) {
      // Map Supabase error codes to opaque client codes
      if (error.message?.includes('already registered') || error.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'email_taken' }, { status: 409 })
      }
      console.error('[yearns/signup] createUser error:', error)
      return NextResponse.json({ error: 'signup_failed' }, { status: 500 })
    }

    return NextResponse.json({ userId: data.user.id }, { status: 201 })
  } catch (err) {
    console.error('[yearns/signup] unexpected error:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
