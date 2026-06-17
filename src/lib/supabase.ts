/**
 * Yearns — Supabase client factory
 *
 * Three distinct clients for three distinct contexts:
 *
 * 1. createServerClient()  — for API route handlers (Edge runtime)
 *    Uses service role key. Bypasses RLS. Use only server-side.
 *    Scope all queries manually to auth.uid() — RLS won't protect you.
 *
 * 2. createUserClient(jwt) — for API routes acting on behalf of a user
 *    Uses anon key + user JWT. RLS is active. Preferred for user-data queries.
 *
 * 3. createBrowserClient() — for client components
 *    Uses anon key. RLS active. Auth state managed by Supabase Auth helpers.
 */

import { createClient } from '@supabase/supabase-js'
import { createBrowserClient as ssrCreateBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ─── Server client (service role — bypasses RLS) ──────────────────────────────
// Use for: webhook handlers, background jobs, admin operations.
// NEVER use this to query user data without explicit .eq('user_id', userId).
// RLS is bypassed — all data is visible. Treat with care.

export function createServerClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        // Identifies server-side requests in Supabase logs
        'x-yearns-client': 'server',
      },
    },
  })
}

// ─── User client (anon key + user JWT — RLS active) ───────────────────────────
// Use for: API routes that operate on behalf of a specific authenticated user.
// RLS policies enforce row-level access. Preferred over service client
// for any user-data operation.

export function createUserClient(userJwt: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
        'x-yearns-client': 'user-server',
      },
    },
  })
}

// ─── Browser client (@supabase/ssr — cookie-backed, RLS active) ───────────────
// Use for: client components, hooks, onboarding flow.
// Uses cookies (not localStorage) so middleware can read the session server-side.
// @supabase/ssr handles deduplication internally — safe to call multiple times.

export function createBrowserClient() {
  return ssrCreateBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

export type ServerClient  = ReturnType<typeof createServerClient>
export type UserClient    = ReturnType<typeof createUserClient>
export type BrowserClient = ReturnType<typeof createBrowserClient>
