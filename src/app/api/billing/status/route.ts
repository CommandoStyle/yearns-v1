import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export async function GET(request: NextRequest): Promise<Response> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const jwt = request.headers.get('Authorization')?.slice(7)
  if (!jwt) return new Response(JSON.stringify({ tier: 'free', status: null }), { status: 200 })

  const { data: { user } } = await supabase.auth.getUser(jwt)
  if (!user) return new Response(JSON.stringify({ tier: 'free', status: null }), { status: 200 })

  const { data } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status, monthly_usage')
    .eq('id', user.id)
    .single()

  return Response.json({
    tier:          data?.subscription_tier  ?? 'free',
    status:        data?.subscription_status ?? null,
    monthly_usage: data?.monthly_usage       ?? 0,
  })
}
