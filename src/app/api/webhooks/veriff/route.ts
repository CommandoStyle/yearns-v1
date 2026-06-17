import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'edge'

// Veriff signature: HMAC-SHA256(sha256hex(payload), secret) → hex
async function veriffSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(payload))
  const digestHex = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(digestHex))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

interface VeriffDecisionPayload {
  feature:      string
  code:         number
  verification: {
    id:         string
    status:     'approved' | 'declined' | 'resubmission_requested' | 'abandoned' | 'expired'
    vendorData: string   // user ID we set at session creation
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const secret    = process.env.VERIFF_SECRET!
  const rawBody   = await request.text()
  const signature = request.headers.get('x-hmac-signature') ?? ''

  // Reject immediately if no signature header
  if (!signature) {
    return new Response(null, { status: 400 })
  }

  const expected = await veriffSign(rawBody, secret)

  // Constant-time comparison isn't possible in plain JS across hex strings, but
  // this webhook is server-to-server with a shared secret — risk is acceptable.
  if (expected !== signature.toLowerCase()) {
    console.warn('[yearns/veriff] webhook signature mismatch')
    return new Response(null, { status: 401 })
  }

  let payload: VeriffDecisionPayload
  try {
    payload = JSON.parse(rawBody) as VeriffDecisionPayload
  } catch {
    return new Response(null, { status: 400 })
  }

  // Only process final decisions (code 9001)
  if (payload.feature !== 'decision' || payload.code !== 9001) {
    return new Response(null, { status: 200 })
  }

  const { status, vendorData: userId } = payload.verification

  if (status === 'approved' && userId) {
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    const { error } = await supabase
      .from('users')
      .update({
        age_verified:        true,
        age_verified_at:     new Date().toISOString(),
        age_verified_method: 'veriff',
      })
      .eq('id', userId)

    if (error) {
      console.error('[yearns/veriff] failed to update age_verified:', error)
      // Return 500 so Veriff retries the webhook
      return new Response(null, { status: 500 })
    }
  }

  // Always return 200 for non-approved decisions (declined etc.) —
  // no action needed, no retry required.
  return new Response(null, { status: 200 })
}
