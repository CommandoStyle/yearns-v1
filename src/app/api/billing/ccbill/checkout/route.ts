import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { ccbillPriceHash, CCBILL_PLANS, type CcbillPlanKey } from '@/lib/ccbill'

export const runtime = 'edge'

// CCBill FlexForms checkout URL.
// The FLEXFORM_ID comes from your CCBill account manager and encodes
// the account, form layout, and allowed payment methods.
const CCBILL_BASE = 'https://api.ccbill.com/wap-frontflex/flexforms'
const CURRENCY    = '840'   // USD
const REBILLS     = 99      // unlimited recurring

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

  let plan: CcbillPlanKey = 'monthly'
  try {
    const body = await request.json() as { plan?: string }
    if (body.plan === 'annual') plan = 'annual'
  } catch { /* default to monthly */ }

  const flexformId = process.env.CCBILL_FLEXFORM_ID
  const accnum     = process.env.CCBILL_ACCOUNT_NUMBER
  const subacc     = process.env.CCBILL_SUB_ACCOUNT_NUMBER
  const salt       = process.env.CCBILL_WEBHOOK_SECRET!

  if (!flexformId || !accnum || !subacc) {
    console.error('[yearns/ccbill] missing env vars — CCBILL_FLEXFORM_ID, CCBILL_ACCOUNT_NUMBER, or CCBILL_SUB_ACCOUNT_NUMBER not set')
    return Response.json({ error: 'ccbill_not_configured' }, { status: 503 })
  }

  const { initialPrice, initialPeriod, recurringPrice, recurringPeriod } = CCBILL_PLANS[plan]

  const priceHash = ccbillPriceHash({
    initialPrice,
    initialPeriod,
    recurringPrice,
    recurringPeriod,
    rebills:      REBILLS,
    currencyCode: CURRENCY,
    salt,
  })

  const params = new URLSearchParams({
    clientAccnum:     accnum,
    clientSubacc:     subacc,
    initialPrice,
    initialPeriod:    String(initialPeriod),
    recurringPrice,
    recurringPeriod:  String(recurringPeriod),
    rebills:          String(REBILLS),
    currencyCode:     CURRENCY,
    priceHash,
    // Pass user ID through so the postback webhook can identify the user.
    // CCBill returns this as `clientUserId` in the postback.
    clientUserId:     user.id,
  })

  const url = `${CCBILL_BASE}/${flexformId}?${params.toString()}`

  return Response.json({ url })
}
