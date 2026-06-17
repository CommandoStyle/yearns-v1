import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getStripe } from '@/lib/stripe'

export const runtime = 'edge'

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

  const { data: { user }, error: authError } = await supabase.auth.getUser(header.slice(7))
  if (authError || !user) {
    return Response.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!sub?.stripe_customer_id) {
    return Response.json({ error: 'no_subscription' }, { status: 404 })
  }

  const stripe  = getStripe()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   sub.stripe_customer_id,
    return_url: `${appUrl}/read`,
  })

  return Response.json({ url: portalSession.url })
}
