import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const runtime = 'edge'

const VERIFF_API_URL = 'https://stationapi.veriff.com/v1/sessions'

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

export async function POST(request: NextRequest): Promise<Response> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const { data: { user }, error } = await supabase.auth.getUser(header.slice(7))
  if (error || !user) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const apiKey = process.env.VERIFF_API_KEY!
  const secret  = process.env.VERIFF_SECRET!
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const body = JSON.stringify({
    verification: {
      callback:   `${appUrl}/verify-age?returning=1`,
      vendorData: user.id,
      timestamp:  new Date().toISOString(),
    },
  })

  const signature = await veriffSign(body, secret)

  const veriffRes = await fetch(VERIFF_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-AUTH-CLIENT':   apiKey,
      'X-HMAC-SIGNATURE': signature,
    },
    body,
  })

  if (!veriffRes.ok) {
    console.error('[yearns/veriff] session creation failed:', veriffRes.status)
    return Response.json({ error: 'veriff_unavailable' }, { status: 502 })
  }

  const { verification } = await veriffRes.json() as {
    verification: { url: string; id: string }
  }

  return Response.json({ url: verification.url, sessionId: verification.id })
}
