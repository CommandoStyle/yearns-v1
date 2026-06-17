import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { verifyCcbillPostback } from '@/lib/ccbill'

export const runtime = 'edge'

// CCBill sends postbacks as GET or POST with URL-encoded parameters.
// Configure your postback URL in the CCBill admin under:
// Account → Sub Accounts → [sub account] → Background Post URL
// Set to: https://yearns.app/api/webhooks/ccbill

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function parseParams(request: NextRequest): Promise<URLSearchParams> {
  if (request.method === 'GET') {
    return new URL(request.url).searchParams
  }
  const body = await request.text()
  return new URLSearchParams(body)
}

async function syncCcbillSubscription(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  subscriptionId: string,
  plan: 'pro_monthly' | 'pro_annual',
  status: 'active' | 'cancelled',
) {
  await supabase.from('subscriptions').upsert({
    user_id:               userId,
    ccbill_subscription_id: subscriptionId,
    plan,
    status,
  }, { onConflict: 'user_id' })

  await supabase.rpc('sync_subscription_to_user', { p_user_id: userId })
}

export async function POST(request: NextRequest): Promise<Response> {
  return handlePostback(request)
}

export async function GET(request: NextRequest): Promise<Response> {
  return handlePostback(request)
}

async function handlePostback(request: NextRequest): Promise<Response> {
  const params = await parseParams(request)
  const salt   = process.env.CCBILL_WEBHOOK_SECRET!

  // CCBill event type (set in admin → Approval/Denial/Cancellation post URLs)
  const eventType = params.get('eventType') ?? 'NewSaleSuccess'

  const subscriptionId = params.get('subscriptionId') ?? ''
  const digest         = params.get('digest') ?? ''
  const userId         = params.get('clientUserId') ?? ''

  // Verify the postback digest when present.
  // Some CCBill configs omit the digest — only reject if one was sent but wrong.
  if (digest && subscriptionId) {
    if (!verifyCcbillPostback(subscriptionId, digest, salt)) {
      console.warn('[yearns/ccbill] postback digest mismatch — possible spoofed request')
      return new Response(null, { status: 401 })
    }
  }

  if (!userId) {
    // clientUserId not set — can't identify the user. Log and return 200
    // so CCBill doesn't retry forever.
    console.warn('[yearns/ccbill] postback missing clientUserId — cannot process')
    return new Response(null, { status: 200 })
  }

  const supabase = getServiceClient()

  // Determine plan from billing period
  const period = parseInt(params.get('initialPeriod') ?? params.get('recurringPeriod') ?? '30', 10)
  const plan: 'pro_monthly' | 'pro_annual' = period >= 365 ? 'pro_annual' : 'pro_monthly'

  try {
    switch (eventType) {

      case 'NewSaleSuccess':
      case 'RenewalSuccess': {
        await syncCcbillSubscription(supabase, userId, subscriptionId, plan, 'active')
        break
      }

      case 'Cancellation':
      case 'Expiration':
      case 'ChargebackIssued': {
        await syncCcbillSubscription(supabase, userId, subscriptionId, plan, 'cancelled')
        break
      }

      case 'NewSaleFailure': {
        // Payment declined — no subscription created. No DB change needed.
        // Log for analytics.
        console.info('[yearns/ccbill] sale declined for user:', userId,
          'reason:', params.get('failureReason'))
        break
      }

      default:
        // Unknown event — log but return 200 to prevent retries.
        console.info('[yearns/ccbill] unhandled event type:', eventType)
    }
  } catch (err) {
    console.error('[yearns/ccbill] postback handler error:', err)
    return new Response(null, { status: 500 })
  }

  // CCBill expects 200 to confirm receipt.
  return new Response(null, { status: 200 })
}
