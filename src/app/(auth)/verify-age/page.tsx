'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createBrowserClient } from '@/lib/supabase'

type Stage =
  | 'idle'
  | 'starting'
  | 'redirecting'
  | 'checking'
  | 'approved'
  | 'timeout'
  | 'failed'

export default function VerifyAgePage() {
  const { session, isLoading } = useAuth()
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('idle')

  const checkVerified = useCallback(async (attempt: number): Promise<void> => {
    try {
      const supabase = createBrowserClient()
      const { data } = await supabase
        .from('users')
        .select('age_verified, onboarding_complete')
        .single()

      if (data?.age_verified) {
        setStage('approved')
        setTimeout(() => {
          router.push(data.onboarding_complete ? '/read' : '/onboarding')
        }, 1200)
        return
      }
    } catch { /* network issue — will retry */ }

    if (attempt >= 15) {
      setStage('timeout')
      return
    }

    setTimeout(() => checkVerified(attempt + 1), 2000)
  }, [router])

  // On mount: if already verified (e.g. dev flag flip, or returning to this page
  // after approval), skip straight through without touching Veriff.
  useEffect(() => {
    if (isLoading || !session) return
    if (typeof window === 'undefined') return
    // If returning from Veriff, the poll loop handles it — don't double-fire.
    if (new URLSearchParams(window.location.search).has('returning')) return

    const supabase = createBrowserClient()
    supabase
      .from('users')
      .select('age_verified, onboarding_complete')
      .single()
      .then(({ data }) => {
        if (data?.age_verified) {
          setStage('approved')
          setTimeout(() => {
            router.push(data?.onboarding_complete ? '/read' : '/onboarding')
          }, 1200)
        }
      })
  }, [isLoading, session, router])

  // If returning from Veriff, skip straight to polling
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).has('returning')) {
      setStage('checking')
      checkVerified(0)
    }
  }, [checkVerified])

  async function startVerification() {
    if (!session?.access_token) return
    setStage('starting')

    try {
      const res = await fetch('/api/veriff/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error()
      const { url } = await res.json() as { url: string }
      setStage('redirecting')
      window.location.href = url
    } catch {
      setStage('failed')
    }
  }

  if (isLoading) return null

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-10 text-center animate-fade-up">

        {/* Brand */}
        <div className="space-y-1">
          <h1 className="font-serif text-3xl text-yearns-cream tracking-tight">Yearns</h1>
          <p className="text-yearns-gold/60 text-xs tracking-widest uppercase">
            Age verification
          </p>
        </div>

        {/* Idle */}
        {stage === 'idle' && (
          <>
            <div className="space-y-4">
              <p className="font-serif text-yearns-cream/80 text-xl">One quick step</p>
              <p className="text-yearns-cream/45 text-sm leading-relaxed">
                To comply with UK online safety regulations, we need to confirm you're
                18 or older before you can read. This takes about a minute. Your details
                are handled securely by Veriff, a specialist age verification provider.
              </p>
            </div>
            <button
              onClick={startVerification}
              disabled={!session}
              className="w-full py-4 border border-yearns-gold/50 text-yearns-gold font-serif text-base tracking-wide hover:bg-yearns-gold/8 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Begin verification
            </button>
          </>
        )}

        {/* Starting / redirecting */}
        {(stage === 'starting' || stage === 'redirecting') && (
          <p className="text-yearns-cream/45 text-sm animate-pulse">
            {stage === 'starting' ? 'Starting…' : 'Opening Veriff…'}
          </p>
        )}

        {/* Checking */}
        {stage === 'checking' && (
          <div className="space-y-5">
            <div className="mx-auto w-7 h-7 rounded-full border border-yearns-gold/25 border-t-yearns-gold/75 animate-spin" />
            <p className="text-yearns-cream/45 text-sm">
              Confirming your verification…
            </p>
          </div>
        )}

        {/* Approved */}
        {stage === 'approved' && (
          <div className="space-y-3">
            <p className="font-serif text-yearns-cream/90 text-xl">Verified.</p>
            <p className="text-yearns-cream/40 text-sm">Taking you through now…</p>
          </div>
        )}

        {/* Timeout */}
        {stage === 'timeout' && (
          <div className="space-y-7">
            <p className="text-yearns-cream/50 text-sm leading-relaxed">
              Your verification is still being processed. This can take a few
              minutes — come back shortly.
            </p>
            <button
              onClick={() => { setStage('checking'); checkVerified(0) }}
              className="w-full py-3 border border-yearns-cream/15 text-yearns-cream/45 text-xs tracking-widest uppercase hover:border-yearns-cream/30 hover:text-yearns-cream/65 transition-all duration-200"
            >
              Check again
            </button>
          </div>
        )}

        {/* Failed */}
        {stage === 'failed' && (
          <div className="space-y-7">
            <p className="text-yearns-cream/45 text-sm leading-relaxed">
              We couldn't start your verification. Please try again.
            </p>
            <button
              onClick={() => setStage('idle')}
              className="w-full py-3 border border-yearns-gold/30 text-yearns-gold/65 text-xs tracking-widest uppercase hover:border-yearns-gold/55 hover:text-yearns-gold transition-all duration-200"
            >
              Try again
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
