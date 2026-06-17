import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'edge'

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

  if (!code) {
    return NextResponse.redirect(`${origin}/signup?error=auth_failed`)
  }

  // Create a redirect response now so the setAll callback can attach cookies.
  // We'll update the destination once we know the user's state.
  let destination = `${origin}/verify-age`
  const response  = NextResponse.redirect(destination)

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/signup?error=auth_failed`)
  }

  // Check the user's onboarding state to send them to the right page.
  // Use service role (bypasses RLS) to read without requiring the new
  // session cookies to be readable from the same request.
  const service = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: userData } = await service
    .from('users')
    .select('age_verified, onboarding_complete')
    .eq('id', data.session.user.id)
    .single()

  if (userData?.age_verified && userData?.onboarding_complete) {
    destination = `${origin}/read`
  } else if (userData?.age_verified) {
    destination = `${origin}/onboarding`
  }
  // else: stays at /verify-age (default)

  // Redirect destination is on the response object we already have.
  // We need to create a new one to update the URL while keeping the cookies.
  const finalResponse = NextResponse.redirect(destination)
  response.cookies.getAll().forEach(({ name, value, ...options }) => {
    finalResponse.cookies.set(name, value, options)
  })

  return finalResponse
}
