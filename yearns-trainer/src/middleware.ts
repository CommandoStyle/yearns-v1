/**
 * Yearns — Trainer middleware
 * Protects all routes under /trainer and /api/trainer.
 * Checks: authenticated → age_verified → role is 'trainer' or 'admin'.
 *
 * Drop this file at src/middleware.ts (or merge with existing middleware).
 * It runs on the Edge runtime before any route handler.
 *
 * Route protection matrix:
 *   /trainer/*          → requires trainer or admin role
 *   /api/trainer/*      → requires trainer or admin role
 *   /api/generate       → requires age_verified (handled in route handler)
 *   everything else     → public or handled by Supabase Auth
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const config = {
  matcher: [
    '/trainer/:path*',
    '/api/trainer/:path*',
  ],
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Extract JWT from Authorization header or cookie
  // Supabase Auth sets sb-access-token cookie on the browser client
  const authHeader = request.headers.get('Authorization')
  const cookieToken = request.cookies.get('sb-access-token')?.value
  const jwt = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : cookieToken

  if (!jwt) {
    return redirectToLogin(request)
  }

  // Verify JWT and fetch role in a single query using service role client
  // (Supabase anon key can't verify JWTs server-side on Edge)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: { user }, error } = await supabase.auth.getUser(jwt)

  if (error || !user) {
    return redirectToLogin(request)
  }

  // Fetch role from users table
  const { data: userRecord } = await supabase
    .from('users')
    .select('role, age_verified')
    .eq('id', user.id)
    .single()

  if (!userRecord) {
    return redirectToLogin(request)
  }

  // Trainers must be age-verified (they handle explicit content)
  if (!userRecord.age_verified) {
    return NextResponse.redirect(new URL('/verify-age', request.url))
  }

  // Role check — trainer or admin only
  if (!['trainer', 'admin'].includes(userRecord.role)) {
    // Return 403 for API routes, redirect for UI routes
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Pass user id and role downstream via headers
  // Route handlers can read these without re-querying the DB
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-trainer-id', user.id)
  requestHeaders.set('x-trainer-role', userRecord.role)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}
