'use client'

/**
 * PasskeyPrompt — shown after password login to offer passkey registration.
 * Dismissed permanently via localStorage flag; never shown again once registered.
 */

import { useState } from 'react'
import {
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'

interface PasskeyPromptProps {
  onDismiss: () => void
}

export function PasskeyPrompt({ onDismiss }: PasskeyPromptProps) {
  const [stage, setStage] = useState<'idle' | 'registering' | 'done' | 'error'>('idle')

  if (!browserSupportsWebAuthn()) {
    onDismiss()
    return null
  }

  async function handleRegister() {
    setStage('registering')
    try {
      const optRes = await fetch('/api/auth/passkey/register-options')
      const options = await optRes.json()

      const credential = await startRegistration({ optionsJSON: options })

      const verifyRes = await fetch('/api/auth/passkey/register-verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ response: credential }),
      })

      if (!verifyRes.ok) throw new Error('Verification failed')

      localStorage.setItem('yn_passkey_registered', '1')
      setStage('done')
      setTimeout(onDismiss, 1500)
    } catch (err) {
      console.error('[PasskeyPrompt] registration error:', err)
      setStage('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/20 backdrop-blur-sm px-4 pb-8">
      <div className="w-full max-w-sm bg-white border border-gray-900/10 p-8 space-y-6 animate-fade-up">

        <div className="space-y-2">
          <p className="font-serif text-xl text-gray-900">Sign in faster next time</p>
          <p className="text-gray-900/50 text-sm leading-relaxed">
            Set up a passkey to sign in with Face ID, Touch ID, or your device PIN — no password needed.
          </p>
        </div>

        {stage === 'done' && (
          <p className="text-gray-900/60 text-sm">Passkey saved. You&apos;re all set.</p>
        )}

        {stage === 'error' && (
          <p className="text-gray-900/50 text-sm border border-gray-900/10 px-4 py-3">
            Could not register passkey. You can try again in Settings.
          </p>
        )}

        {(stage === 'idle' || stage === 'error') && (
          <div className="space-y-3">
            <button
              onClick={handleRegister}
              className="w-full py-4 border border-gray-600/50 text-gray-600 font-serif text-base tracking-wide hover:bg-gray-600/8 transition-all duration-300"
            >
              Set up passkey
            </button>
            <button
              onClick={() => { localStorage.setItem('yn_passkey_dismissed', '1'); onDismiss() }}
              className="w-full text-gray-900/30 text-xs tracking-widest uppercase hover:text-gray-900/55 transition-colors duration-200 py-2"
            >
              Not now
            </button>
          </div>
        )}

        {stage === 'registering' && (
          <p className="text-gray-900/40 text-sm text-center">Follow the prompt on your device…</p>
        )}

      </div>
    </div>
  )
}
