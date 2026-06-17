'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

type Stage = 'idle' | 'sending' | 'sent' | 'error'

const ERROR_COPY: Record<string, string> = {
  auth_failed: 'The sign-in link expired or was already used. Request a new one below.',
  default:     'Something went wrong. Please try again.',
}

function SignupForm() {
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error')

  const [email, setEmail]   = useState('')
  const [stage, setStage]   = useState<Stage>(callbackError ? 'error' : 'idle')
  const [errMsg, setErrMsg] = useState(
    callbackError ? (ERROR_COPY[callbackError] ?? ERROR_COPY.default) : '',
  )

  // Redirect already-authenticated users away from this page
  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.replace('/read')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStage('sending')

    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    })

    if (error) {
      // Log actual Supabase error for debugging — never shown to users
      console.error('[signup] signInWithOtp error:', error.status, error.message, error.name)
      setErrMsg(ERROR_COPY.default)
      setStage('error')
    } else {
      setStage('sent')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-10 text-center animate-fade-up">

        {/* Brand */}
        <div className="space-y-1">
          <h1 className="font-serif text-4xl text-yearns-cream tracking-tight">Yearns</h1>
          <p className="text-yearns-gold/60 text-xs tracking-widest uppercase">
            Your story awaits
          </p>
        </div>

        {/* Idle / error — show form */}
        {(stage === 'idle' || stage === 'error' || stage === 'sending') && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {stage === 'error' && (
              <p className="text-yearns-cream/45 text-sm border border-yearns-cream/10 px-4 py-3 leading-relaxed">
                {errMsg}
              </p>
            )}

            <div className="space-y-2 text-left">
              <label
                htmlFor="email"
                className="block text-yearns-cream/45 text-xs tracking-widest uppercase"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-transparent border-b border-yearns-cream/20 text-yearns-cream placeholder-yearns-cream/20 py-2.5 text-sm focus:outline-none focus:border-yearns-gold/60 transition-colors duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={stage === 'sending' || !email.trim()}
              className="w-full py-4 border border-yearns-gold/50 text-yearns-gold font-serif text-base tracking-wide hover:bg-yearns-gold/8 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {stage === 'sending' ? 'Sending…' : 'Continue'}
            </button>

            <p className="text-yearns-cream/25 text-xs leading-relaxed">
              We'll send you a sign-in link. No password needed.
              New here? Your account is created automatically.
            </p>
          </form>
        )}

        {/* Sent confirmation */}
        {stage === 'sent' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="font-serif text-yearns-cream/90 text-xl">Check your inbox</p>
              <p className="text-yearns-cream/45 text-sm leading-relaxed">
                We sent a sign-in link to{' '}
                <span className="text-yearns-cream/75">{email}</span>.
                Click it to continue — the link expires in 1 hour.
              </p>
            </div>
            <button
              onClick={() => { setEmail(''); setStage('idle') }}
              className="text-yearns-cream/30 text-xs tracking-widest uppercase hover:text-yearns-cream/55 transition-colors duration-200"
            >
              Use a different email
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// useSearchParams() requires a Suspense boundary in Next.js 14
import { Suspense } from 'react'

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
