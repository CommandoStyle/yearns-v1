import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getStripe, PRICES, planFromPriceId } from '@/lib/stripe'
import type { PlanKey } from '@/lib/stripe'

export const runtime = 'edge'

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function authenticate(request: NextRequest) {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const supabase = getServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(header.slice(7))
  if (error || !user) return null
  return { user, supabase }
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) return Response.json({ error: 'unauthenticated' }, { status: 401 })

  let plan: PlanKey = 'monthly'
  try {
    const body = await request.json() as { plan?: string }
    if (body.plan === 'annual') plan = 'annual'
  } catch { /* default to monthly */ }

  const stripe  = getStripe()
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const userId  = auth.user.id
  const email   = auth.user.email!

  // Retrieve or create Stripe customer for this user
  const { data: existingSub } = await auth.supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()

  let customerId: string

  if (existingSub?.stripe_customer_id) {
    customerId = existingSub.stripe_customer_id
  } else {
    const customer = await stripe.customers.create({
      email,
      metadata: { yearns_user_id: userId },
    })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    customer:                    customerId,
    mode:                        'subscription',
    line_items:                  [{ price: PRICES[plan], quantity: 1 }],
    success_url:                 `${appUrl}/read?upgraded=1`,
    cancel_url:                  `${appUrl}/read`,
    metadata:                    { user_id: userId },
    allow_promotion_codes:       true,
    billing_address_collection:  'auto',
    subscription_data: {
      metadata: { user_id: userId },
    },
  })

  if (!session.url) {
    return Response.json({ error: 'checkout_failed' }, { status: 502 })
  }

  return Response.json({ url: session.url })
}
