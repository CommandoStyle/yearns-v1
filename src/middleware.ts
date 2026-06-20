import { createServerClient } from '@supabase/ssr'
import { createClient }       from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require an authenticated session.
// Unauthenticated visitors are redirected to /signup.
const PROTECTED_PREFIXES = ['/read', '/onboarding', '/settings']

// Routes that additionally require trainer or admin role.
const TRAINER_PREFIXES = ['/trainer', '/api/trainer', '/admin', '/api/admin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Step 1: Refresh Supabase session (always — keeps tokens current) ────────
  // Supabase requires this response to be returned (with refreshed cookies)
  // even when we're not redirecting. Always return `supabaseResponse`, never
  // an independent NextResponse.next() — that would drop the refreshed tokens.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Use getSession() here (reads cookie, no network call) to avoid hitting
  // the Vercel Edge 1.5s middleware timeout. getUser() makes a round-trip to
  // Supabase Auth on every request which causes 504s under load. Individual
  // API route handlers call getUser() when they need server-verified identity.
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // ── Step 2: Trainer route protection ─────────────────────────────────────────
  // Trainer routes need auth + age_verified + role check.
  // We do this before the general protected route check so trainer API routes
  // return 403 JSON (not a signup redirect).
  const isTrainerRoute = TRAINER_PREFIXES.some(p => pathname.startsWith(p))

  if (isTrainerRoute) {
    if (!user) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
      }
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Fetch role and age_verified in one query via service role client.
    // Service role bypasses RLS — we scope the query to the user's own ID.
    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    const { data: userRecord } = await service
      .from('users')
      .select('role, age_verified')
      .eq('id', user.id)
      .single()

    // Trainers must be age-verified (they handle explicit content)
    if (!userRecord?.age_verified) {
      return NextResponse.redirect(new URL('/verify-age', request.url))
    }

    // Role check — trainer or admin only
    if (!['trainer', 'admin'].includes(userRecord?.role ?? '')) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Pass trainer id and role to route handlers via headers
    // (avoids re-querying the DB in each route handler)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-trainer-id',   user.id)
    requestHeaders.set('x-trainer-role',  userRecord.role)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // ── Step 3: General app route protection ─────────────────────────────────────
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static assets.
    // This is required so Supabase can refresh session tokens on every request.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
