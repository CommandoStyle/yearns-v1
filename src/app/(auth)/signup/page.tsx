'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createBrowserClient } from '@/lib/supabase'

type Stage = 'idle' | 'submitting' | 'error'

const ERROR_COPY: Record<string, string> = {
  email_taken:    'An account with that email already exists. Sign in instead.',
  password_too_short: 'Password must be at least 8 characters.',
  signup_failed:  'Something went wrong. Please try again.',
  default:        'Something went wrong. Please try again.',
}

function SignupForm() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [stage,    setStage]    = useState<Stage>('idle')
  const [errMsg,   setErrMsg]   = useState('')

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/read')
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setStage('submitting')
    setErrMsg('')

    // 1. Create account server-side (bypasses email confirmation)
    const res = await fetch('/api/auth/signup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email.trim(), password }),
    })

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'default' }))
      setErrMsg(ERROR_COPY[error as string] ?? ERROR_COPY.default)
      setStage('error')
      return
    }

    // 2. Immediately sign in with password
    const supabase = createBrowserClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    })

    if (signInError) {
      console.error('[signup] signInWithPassword error:', signInError)
      setErrMsg(ERROR_COPY.default)
      setStage('error')
      return
    }

    router.replace('/onboarding')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-10 text-center animate-fade-up">

        {/* Brand */}
        <div className="space-y-1">
          <h1 className="font-serif text-4xl text-gray-900 tracking-tight">Yearns</h1>
          <p className="text-gray-600/60 text-xs tracking-widest uppercase">
            Create your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {stage === 'error' && (
            <p className="text-gray-900/45 text-sm border border-gray-900/10 px-4 py-3 leading-relaxed">
              {errMsg}
            </p>
          )}

          <div className="space-y-5 text-left">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-gray-900/45 text-xs tracking-widest uppercase">
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
                className="w-full bg-transparent border-b border-gray-900/20 text-gray-900 placeholder-gray-900/20 py-2.5 text-sm focus:outline-none focus:border-gray-600/60 transition-colors duration-200"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-gray-900/45 text-xs tracking-widest uppercase">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full bg-transparent border-b border-gray-900/20 text-gray-900 placeholder-gray-900/20 py-2.5 text-sm focus:outline-none focus:border-gray-600/60 transition-colors duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={stage === 'submitting' || !email.trim() || !password}
            className="w-full py-4 border border-gray-600/50 text-gray-600 font-serif text-base tracking-wide hover:bg-gray-600/8 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {stage === 'submitting' ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-gray-900/25 text-xs leading-relaxed">
            Already have an account?{' '}
            <Link href="/login" className="text-gray-900/45 underline hover:text-gray-900/70 transition-colors">
              Sign in
            </Link>
          </p>
        </form>

      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
