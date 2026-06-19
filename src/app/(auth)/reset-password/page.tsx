'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'

type Stage = 'idle' | 'submitting' | 'sent' | 'error'

function ResetPasswordForm() {
  const [email, setEmail] = useState('')
  const [stage, setStage] = useState<Stage>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStage('submitting')

    await fetch('/api/auth/reset-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email.trim() }),
    })

    // Always show "sent" — prevents user enumeration
    setStage('sent')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-10 text-center animate-fade-up">

        <div className="space-y-1">
          <h1 className="font-serif text-4xl text-gray-900 tracking-tight">Yearns</h1>
          <p className="text-gray-600/60 text-xs tracking-widest uppercase">
            Reset your password
          </p>
        </div>

        {stage === 'sent' ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="font-serif text-gray-900/90 text-xl">Check your inbox</p>
              <p className="text-gray-900/45 text-sm leading-relaxed">
                If an account exists for <span className="text-gray-900/75">{email}</span>,
                we&apos;ve sent a password reset link.
              </p>
            </div>
            <Link
              href="/login"
              className="block text-gray-900/30 text-xs tracking-widest uppercase hover:text-gray-900/55 transition-colors duration-200"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 text-left">
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

            <button
              type="submit"
              disabled={stage === 'submitting' || !email.trim()}
              className="w-full py-4 border border-gray-600/50 text-gray-600 font-serif text-base tracking-wide hover:bg-gray-600/8 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {stage === 'submitting' ? 'Sending…' : 'Send reset link'}
            </button>

            <Link
              href="/login"
              className="block text-gray-900/25 text-xs tracking-widest uppercase hover:text-gray-900/50 transition-colors duration-200"
            >
              Back to sign in
            </Link>
          </form>
        )}

      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
