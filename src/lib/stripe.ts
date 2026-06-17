import Stripe from 'stripe'

// Plan price IDs configured in Stripe dashboard.
// Must be set before launch — generate/checkout routes fail if unset.
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_PRO_MONTHLY!,
  annual:  process.env.STRIPE_PRICE_PRO_ANNUAL!,
} as const

export type PlanKey = keyof typeof PRICES

// Returns an edge-compatible Stripe client.
// Instantiated per-request — not a module-level singleton, since edge
// functions may be cold-started and don't share module memory across calls.
export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion:   '2025-02-24.acacia',
    httpClient:   Stripe.createFetchHttpClient(),     // required for Edge runtime
  })
}

// Edge-compatible crypto provider for webhook signature verification.
// Uses Web Crypto (crypto.subtle) instead of Node.js crypto.
export function getStripeCryptoProvider() {
  return Stripe.createSubtleCryptoProvider()
}

// Maps a Stripe price ID to our internal plan name.
export function planFromPriceId(priceId: string): 'pro_monthly' | 'pro_annual' | 'free' {
  if (priceId === PRICES.monthly) return 'pro_monthly'
  if (priceId === PRICES.annual)  return 'pro_annual'
  return 'free'
}

// Maps Stripe's subscription status to our DB enum.
// Stripe uses 'canceled' (single l); our schema uses 'cancelled'.
export function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): 'active' | 'cancelled' | 'past_due' | 'incomplete' | 'trialing' | null {
  switch (status) {
    case 'active':    return 'active'
    case 'canceled':  return 'cancelled'
    case 'past_due':  return 'past_due'
    case 'incomplete': return 'incomplete'
    case 'trialing':  return 'trialing'
    default:          return null
  }
}
