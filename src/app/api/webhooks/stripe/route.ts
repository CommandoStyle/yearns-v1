import { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getStripe, getStripeCryptoProvider, planFromPriceId, mapSubscriptionStatus } from '@/lib/stripe'

export const runtime = 'edge'

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// Sync subscription row then update the denormalised users fields.
async function syncSubscription(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  sub: Stripe.Subscription,
) {
  const item    = sub.items.data[0]
  const priceId = item.price.id
  const plan    = planFromPriceId(priceId)
  const status  = mapSubscriptionStatus(sub.status)

  await supabase.from('subscriptions').upsert({
    user_id:               userId,
    stripe_customer_id:    sub.customer as string,
    stripe_subscription_id: sub.id,
    stripe_price_id:       priceId,
    plan,
    status,
    current_period_start:  new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end:    new Date(sub.current_period_end   * 1000).toISOString(),
    cancel_at_period_end:  sub.cancel_at_period_end,
  }, { onConflict: 'user_id' })

  await supabase.rpc('sync_subscription_to_user', { p_user_id: userId })
}

// Look up user_id from stripe_customer_id (used for subscription webhooks
// that don't carry metadata.user_id).
async function userIdByCustomer(
  supabase: ReturnType<typeof getServiceClient>,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.user_id ?? null
}

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody  = await request.text()
  const sig      = request.headers.get('stripe-signature') ?? ''
  const secret   = process.env.STRIPE_WEBHOOK_SECRET!

  const stripe = getStripe()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      secret,
      undefined,
      getStripeCryptoProvider(),
    )
  } catch (err) {
    console.warn('[yearns/stripe] webhook signature invalid:', (err as Error).message)
    return new Response('Signature verification failed', { status: 400 })
  }

  const supabase = getServiceClient()

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const userId         = session.metadata?.user_id
        const subscriptionId = session.subscription as string
        if (!userId || !subscriptionId) break

        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        await syncSubscription(supabase, userId, sub)
        break
      }

      case 'customer.subscription.updated': {
        const sub      = event.data.object as Stripe.Subscription
        const userId   = (sub.metadata?.user_id as string | undefined)
                      ?? await userIdByCustomer(supabase, sub.customer as string)
        if (!userId) break

        await syncSubscription(supabase, userId, sub)
        break
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription
        const userId = (sub.metadata?.user_id as string | undefined)
                    ?? await userIdByCustomer(supabase, sub.customer as string)
        if (!userId) break

        await syncSubscription(supabase, userId, sub)
        break
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const userId     = await userIdByCustomer(supabase, customerId)
        if (!userId) break

        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('stripe_customer_id', customerId)

        await supabase.rpc('sync_subscription_to_user', { p_user_id: userId })
        break
      }

      // All other events: no action needed.
      default:
        break
    }
  } catch (err) {
    console.error('[yearns/stripe] webhook handler error:', err)
    // Return 500 so Stripe retries.
    return new Response('Handler error', { status: 500 })
  }

  return new Response(null, { status: 200 })
}
