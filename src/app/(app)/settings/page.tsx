'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  startRegistration,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser'
import { createBrowserClient } from '@/lib/supabase'
import type { SupportedLanguage } from '@/lib/prompt-engine'

const LANGUAGES: { key: SupportedLanguage; label: string; native: string }[] = [
  { key: 'en', label: 'English',  native: 'English'  },
  { key: 'fr', label: 'French',   native: 'Français' },
  { key: 'it', label: 'Italian',  native: 'Italiano' },
  { key: 'ja', label: 'Japanese', native: '日本語'   },
  { key: 'es', label: 'Spanish',  native: 'Español'  },
  { key: 'de', label: 'German',   native: 'Deutsch'  },
]

interface Credential {
  id:           string
  device_label: string | null
  created_at:   string
  last_used_at: string | null
}

export default function SettingsPage() {
  const router = useRouter()

  const [credentials,    setCredentials]    = useState<Credential[]>([])
  const [loadingCreds,   setLoadingCreds]   = useState(true)
  const [passkeyStage,   setPasskeyStage]   = useState<'idle' | 'registering' | 'done' | 'error'>('idle')
  const [passwordStage,  setPasswordStage]  = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [currentPw,      setCurrentPw]      = useState('')
  const [newPw,          setNewPw]          = useState('')
  const [pwErr,          setPwErr]          = useState('')
  const [language,       setLanguage]       = useState<SupportedLanguage>('en')
  const [langStage,      setLangStage]      = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  const supportsPasskeys = typeof window !== 'undefined' && browserSupportsWebAuthn()

  useEffect(() => {
    loadCredentials()
    loadLanguage()
  }, [])

  async function loadCredentials() {
    setLoadingCreds(true)
    const supabase = createBrowserClient()
    const { data } = await supabase
      .from('webauthn_credentials')
      .select('id, device_label, created_at, last_used_at')
      .order('created_at', { ascending: false })
    setCredentials(data ?? [])
    setLoadingCreds(false)
  }

  async function loadLanguage() {
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('desire_profiles')
      .select('language')
      .eq('user_id', session.user.id)
      .single()
    if (data?.language) setLanguage(data.language as SupportedLanguage)
  }

  async function saveLanguage(lang: SupportedLanguage) {
    setLanguage(lang)
    setLangStage('saving')
    try {
      const supabase = createBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('no session')
      const res = await fetch('/api/profile', {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ language: lang }),
      })
      setLangStage(res.ok ? 'done' : 'error')
    } catch {
      setLangStage('error')
    }
  }

  async function addPasskey() {
    setPasskeyStage('registering')
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
      setPasskeyStage('done')
      await loadCredentials()
    } catch (err) {
      console.error('[settings] add passkey error:', err)
      setPasskeyStage('error')
    }
  }

  async function removePasskey(credentialId: string) {
    const supabase = createBrowserClient()
    await supabase.from('webauthn_credentials').delete().eq('id', credentialId)
    await loadCredentials()
    if (credentials.length <= 1) localStorage.removeItem('yn_passkey_registered')
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (!newPw || newPw.length < 8) {
      setPwErr('New password must be at least 8 characters.')
      return
    }
    setPasswordStage('submitting')
    setPwErr('')

    const supabase = createBrowserClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwErr('Could not update password. Please try signing out and back in first.')
      setPasswordStage('error')
      return
    }
    setCurrentPw('')
    setNewPw('')
    setPasswordStage('done')
  }

  async function handleSignOut() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16 space-y-14">

      <h1 className="font-serif text-3xl text-gray-900">Settings</h1>

      {/* Passkeys section */}
      {supportsPasskeys && (
        <section className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-gray-900/70 text-xs tracking-widest uppercase">Passkeys</h2>
            <p className="text-gray-900/40 text-sm">
              Sign in with Face ID, Touch ID, or your device PIN — no password needed.
            </p>
          </div>

          {loadingCreds ? (
            <p className="text-gray-900/30 text-sm">Loading…</p>
          ) : credentials.length === 0 ? (
            <p className="text-gray-900/40 text-sm">No passkeys registered.</p>
          ) : (
            <ul className="space-y-3">
              {credentials.map(c => (
                <li key={c.id} className="flex items-center justify-between border-b border-gray-900/8 pb-3">
                  <div>
                    <p className="text-gray-900/80 text-sm">{c.device_label ?? 'Unknown device'}</p>
                    <p className="text-gray-900/30 text-xs">
                      Added {new Date(c.created_at).toLocaleDateString()}
                      {c.last_used_at && ` · Last used ${new Date(c.last_used_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <button
                    onClick={() => removePasskey(c.id)}
                    className="text-gray-900/25 text-xs hover:text-gray-900/55 transition-colors"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {passkeyStage === 'error' && (
            <p className="text-gray-900/45 text-sm border border-gray-900/10 px-4 py-3">
              Could not register passkey. Try again.
            </p>
          )}
          {passkeyStage === 'done' && (
            <p className="text-gray-900/60 text-sm">Passkey added.</p>
          )}

          <button
            onClick={addPasskey}
            disabled={passkeyStage === 'registering'}
            className="py-3 px-6 border border-gray-900/20 text-gray-900/60 text-sm hover:bg-gray-900/4 transition-all duration-300 disabled:opacity-40"
          >
            {passkeyStage === 'registering' ? 'Follow device prompt…' : 'Add passkey'}
          </button>
        </section>
      )}

      {/* Change password section */}
      <section className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-gray-900/70 text-xs tracking-widest uppercase">Password</h2>
        </div>

        {passwordStage === 'done' && (
          <p className="text-gray-900/60 text-sm">Password updated.</p>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-5">
          {pwErr && (
            <p className="text-gray-900/45 text-sm border border-gray-900/10 px-4 py-3">{pwErr}</p>
          )}

          <div className="space-y-2">
            <label className="block text-gray-900/45 text-xs tracking-widest uppercase">
              New password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full bg-transparent border-b border-gray-900/20 text-gray-900 placeholder-gray-900/20 py-2.5 text-sm focus:outline-none focus:border-gray-600/60 transition-colors duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={passwordStage === 'submitting' || !newPw}
            className="py-3 px-6 border border-gray-900/20 text-gray-900/60 text-sm hover:bg-gray-900/4 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {passwordStage === 'submitting' ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>

      {/* Story language */}
      <section className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-gray-900/70 text-xs tracking-widest uppercase">Story language</h2>
          <p className="text-gray-900/40 text-sm">
            Your Yearns will be written in this language.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map(({ key, label, native }) => (
            <button
              key={key}
              onClick={() => saveLanguage(key)}
              className={`py-3 px-2 text-center border transition-all duration-200 ${
                language === key
                  ? 'border-gray-600/70 bg-gray-600/5'
                  : 'border-gray-900/12 hover:border-gray-900/25'
              }`}
            >
              <p className={`font-serif text-base ${language === key ? 'text-gray-600' : 'text-gray-900'}`}>
                {native}
              </p>
              <p className="text-gray-900/35 text-[10px] mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {langStage === 'done'  && <p className="text-gray-900/50 text-sm">Language updated.</p>}
        {langStage === 'error' && <p className="text-gray-900/45 text-sm border border-gray-900/10 px-4 py-3">Could not save. Try again.</p>}
      </section>

      {/* Sign out */}
      <section className="pt-6 border-t border-gray-900/8">
        <button
          onClick={handleSignOut}
          className="text-gray-900/30 text-xs tracking-widest uppercase hover:text-gray-900/55 transition-colors"
        >
          Sign out
        </button>
      </section>

    </div>
  )
}
