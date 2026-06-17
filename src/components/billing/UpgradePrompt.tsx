'use client'

import { useState } from 'react'

const FEATURES = [
  'Unlimited Yearns — no monthly cap',
  'Save Yearns to your library',
  'Continue where you left off',
  'Schedule Yearns',
  'ePub export',
]

interface UpgradePromptProps {
  authToken: string | null
  onDismiss: () => void
}

export function UpgradePrompt({ authToken, onDismiss }: UpgradePromptProps) {
  const [plan, setPlan]         = useState<'monthly' | 'annual'>('annual')
  const [isLoading, setIsLoading] = useState(false)
  const [failed, setFailed]     = useState(false)

  async function handleUpgrade() {
    if (!authToken || isLoading) return
    setIsLoading(true)
    setFailed(false)

    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${authToken}`,
      },
      body: JSON.stringify({ plan }),
    }).catch(() => null)

    if (!res?.ok) {
      setIsLoading(false)
      setFailed(true)
      return
    }

    const { url } = await res.json() as { url: string }
    window.location.href = url
    // Keep isLoading true — page is navigating away
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-16">
      <div className="w-full max-w-sm space-y-8 animate-fade-up">

        {/* Heading */}
        <div className="text-center space-y-2">
          <p className="text-yearns-cream/35 text-xs tracking-widest uppercase">
            You've read your 5 free Yearns this month
          </p>
          <h2 className="font-serif text-3xl text-yearns-cream tracking-tight">
            Continue with Pro
          </h2>
        </div>

        {/* Feature list */}
        <ul className="space-y-3">
          {FEATURES.map(f => (
            <li key={f} className="flex items-start gap-3 text-yearns-cream/65 text-sm">
              <span className="text-yearns-gold/60 mt-px">—</span>
              {f}
            </li>
          ))}
        </ul>

        {/* Plan toggle */}
        <div className="flex border border-yearns-cream/12">
          <button
            onClick={() => setPlan('monthly')}
            className={`flex-1 py-4 text-center transition-all duration-200 ${
              plan === 'monthly'
                ? 'bg-yearns-gold/10 text-yearns-gold'
                : 'text-yearns-cream/35 hover:text-yearns-cream/55'
            }`}
          >
            <span className="block text-[10px] tracking-widest uppercase mb-1">Monthly</span>
            <span className="font-serif text-xl">$12.99</span>
          </button>
          <button
            onClick={() => setPlan('annual')}
            className={`flex-1 py-4 text-center border-l border-yearns-cream/12 transition-all duration-200 ${
              plan === 'annual'
                ? 'bg-yearns-gold/10 text-yearns-gold'
                : 'text-yearns-cream/35 hover:text-yearns-cream/55'
            }`}
          >
            <span className="block text-[10px] tracking-widest uppercase mb-1">Annual</span>
            <span className="font-serif text-xl">$99</span>
            <span className="block text-[10px] text-yearns-gold/55 mt-0.5">
              $8.25/mo — save 36%
            </span>
          </button>
        </div>

        {/* Error */}
        {failed && (
          <p className="text-yearns-cream/40 text-xs text-center">
            Something went wrong. Please try again.
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          disabled={isLoading || !authToken}
          className="w-full py-5 border border-yearns-gold/55 text-yearns-gold font-serif text-lg tracking-wide hover:bg-yearns-gold/8 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Opening checkout…' : 'Upgrade to Pro'}
        </button>

        {/* Alternative processor — shown when Stripe is unavailable */}
        <p className="text-yearns-cream/18 text-xs text-center">
          Payment issues?{' '}
          <button
            onClick={async () => {
              if (!authToken || isLoading) return
              setIsLoading(true)
              const res = await fetch('/api/billing/ccbill/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ plan }),
              }).catch(() => null)
              if (res?.ok) {
                const { url } = await res.json() as { url: string }
                window.location.href = url
              } else {
                setIsLoading(false)
              }
            }}
            className="underline underline-offset-2 hover:text-yearns-cream/40 transition-colors duration-200"
          >
            Try an alternative method
          </button>
        </p>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="block w-full text-center text-yearns-cream/22 text-xs tracking-widest uppercase hover:text-yearns-cream/45 transition-colors duration-200"
        >
          Maybe later
        </button>

      </div>
    </div>
  )
}
