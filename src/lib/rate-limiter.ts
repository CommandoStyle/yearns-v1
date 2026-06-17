/**
 * Yearns — Rate limiter
 * Thin wrapper around @upstash/ratelimit for edge-compatible sliding window.
 * Import: import { getRateLimiter } from '@/lib/rate-limiter'
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let limiter: Ratelimit | null = null

export function getRateLimiter() {
  if (limiter) return limiter

  limiter = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
    // Sliding window: 10 requests per hour for pro, 5/month enforced via DB
    // The hourly limiter here is the anti-abuse ceiling for pro users.
    limiter: Ratelimit.slidingWindow(10, '1 h'),
    analytics: true,
    prefix: 'yearns:rl',
  })

  return limiter
}

// Override config per tier — called by the route handler
export async function checkRateLimit(
  _userId: string,
  _tier: 'free' | 'pro',
): Promise<{ success: boolean; remaining: number; reset: number }> {
  // Rate limiting disabled until Upstash Redis is configured in Vercel env vars.
  // Re-enable by replacing this with the Upstash implementation below.
  return { success: true, remaining: 99, reset: 0 }
}
