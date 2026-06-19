'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'
import { createBrowserClient } from '@/lib/supabase'
import { PasskeyPrompt } from '@/components/auth/PasskeyPrompt'

type Stage = 'idle' | 'submitting' | 'error'
type Flow  = 'password' | 'passkey'

const ERROR_COPY: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  verification_failed: 'Passkey authentication failed. Try again or use your password.',
  default:             'Something went wrong. Please try again.',
}

function LoginForm() {
  const router = useRouter()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [flow,     setFlow]     = useState<Flow>('password')
  const [stage,    setStage]    = useState<Stage>('idle')
  const [errMsg,   setErrMsg]   = useState('')
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false)

  const supportsPasskeys = typeof window !== 'undefined' && browserSupportsWebAuthn()
  const hasRegisteredPasskey = typeof window !== 'undefined' && !!localStorage.getItem('yn_passkey_registered')

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/read')
    })
  }, [router])

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setStage('submitting')
    setErrMsg('')

    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setErrMsg(ERROR_COPY.invalid_credentials)
      setStage('error')
      return
    }

    // Offer passkey registration if supported and not yet dismissed
    const dismissed = localStorage.getItem('yn_passkey_dismissed')
    const registered = localStorage.getItem('yn_passkey_registered')
    if (supportsPasskeys && !dismissed && !registered) {
      setShowPasskeyPrompt(true)
    } else {
      router.replace('/read')
    }
  }

  async function handlePasskeyLogin() {
    setStage('submitting')
    setErrMsg('')

    try {
      // Get auth options (scoped to user if email is filled)
      const optRes = await fetch('/api/auth/passkey/auth-options', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(email.trim() ? { email: email.trim() } : {}),
      })
      const options = await optRes.json()

      const credential = await startAuthentication({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/passkey/auth-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ response: credential }),
      })

      if (!verifyRes.ok) {
        const { error } = await verifyRes.json().catch(() => ({ error: 'default' }))
        setErrMsg(ERROR_COPY[error as string] ?? ERROR_COPY.default)
        setStage('error')
        return
      }

      const { token_hash, email: userEmail } = await verifyRes.json()

      // Exchange token_hash for a Supabase session
      const supabase = createBrowserClient()
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'magiclink',
      })

      if (otpError) {
        console.error('[login] verifyOtp error:', otpError)
        setErrMsg(ERROR_COPY.default)
        setStage('error')
        return
      }

      router.replace('/read')
    } catch (err) {
      console.error('[login] passkey error:', err)
      setErrMsg(ERROR_COPY.verification_failed)
      setStage('error')
    }
  }

  if (showPasskeyPrompt) {
    return (
      <PasskeyPrompt
        onDismiss={() => {
          setShowPasskeyPrompt(false)
          router.replace('/read')
        }}
      />
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-10 text-center animate-fade-up">

        {/* Brand */}
        <div className="space-y-1">
          <h1 className="font-serif text-4xl text-gray-900 tracking-tight">Yearns</h1>
          <p className="text-gray-600/60 text-xs tracking-widest uppercase">
            Welcome back
          </p>
        </div>

        {/* Passkey-first: show passkey button prominently if supported + registered */}
        {supportsPasskeys && hasRegisteredPasskey && flow === 'password' && (
          <div className="space-y-4">
            <button
              onClick={handlePasskeyLogin}
              disabled={stage === 'submitting'}
              className="w-full py-4 border border-gray-900/20 text-gray-900/70 font-serif text-base tracking-wide hover:bg-gray-900/4 transition-all duration-300 disabled:opacity-40"
            >
              {stage === 'submitting' ? 'Authenticating…' : 'Sign in with passkey'}
            </button>
            <button
              onClick={() => setFlow('password')}
              className="text-gray-900/30 text-xs tracking-widest uppercase hover:text-gray-900/55 transition-colors"
            >
              Use password instead
            </button>
          </div>
        )}

        {/* Password form */}
        <form onSubmit={handlePasswordLogin} className="space-y-6">
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
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-transparent border-b border-gray-900/20 text-gray-900 placeholder-gray-900/20 py-2.5 text-sm focus:outline-none focus:border-gray-600/60 transition-colors duration-200"
              />
            </div>
          </div>

          {/* Passkey option for devices that support it but haven't registered */}
          {supportsPasskeys && !hasRegisteredPasskey && email.trim() && (
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={stage === 'submitting'}
              className="w-full py-3 border border-gray-900/10 text-gray-900/40 text-sm hover:bg-gray-900/4 transition-all duration-300 disabled:opacity-40"
            >
              Try passkey instead
            </button>
          )}

          <button
            type="submit"
            disabled={stage === 'submitting' || !email.trim() || !password}
            className="w-full py-4 border border-gray-600/50 text-gray-600 font-serif text-base tracking-wide hover:bg-gray-600/8 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {stage === 'submitting' ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="flex justify-between text-xs text-gray-900/25">
            <Link href="/reset-password" className="hover:text-gray-900/50 transition-colors">
              Forgot password?
            </Link>
            <Link href="/signup" className="hover:text-gray-900/50 transition-colors">
              Create account
            </Link>
          </div>
        </form>

      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
