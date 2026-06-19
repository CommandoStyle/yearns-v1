'use client'

/**
 * /auth/update-password
 * Supabase password-reset links redirect here with a session already set
 * (the Supabase Auth callback handles the token exchange before redirect).
 * The user just sets a new password.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

type Stage = 'idle' | 'submitting' | 'done' | 'error'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [stage,    setStage]    = useState<Stage>('idle')
  const [errMsg,   setErrMsg]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setErrMsg('Password must be at least 8 characters.')
      return
    }
    setStage('submitting')
    setErrMsg('')

    const supabase = createBrowserClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setErrMsg('Could not update password. The reset link may have expired.')
      setStage('error')
      return
    }

    setStage('done')
    setTimeout(() => router.replace('/read'), 1500)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-10 text-center animate-fade-up">

        <div className="space-y-1">
          <h1 className="font-serif text-4xl text-gray-900 tracking-tight">Yearns</h1>
          <p className="text-gray-600/60 text-xs tracking-widest uppercase">
            Set new password
          </p>
        </div>

        {stage === 'done' ? (
          <p className="text-gray-900/60 font-serif text-lg">Password updated. Taking you in…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errMsg && (
              <p className="text-gray-900/45 text-sm border border-gray-900/10 px-4 py-3 leading-relaxed">
                {errMsg}
              </p>
            )}

            <div className="space-y-2 text-left">
              <label htmlFor="password" className="block text-gray-900/45 text-xs tracking-widest uppercase">
                New password
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

            <button
              type="submit"
              disabled={stage === 'submitting' || !password}
              className="w-full py-4 border border-gray-600/50 text-gray-600 font-serif text-base tracking-wide hover:bg-gray-600/8 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {stage === 'submitting' ? 'Updating…' : 'Set password'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
