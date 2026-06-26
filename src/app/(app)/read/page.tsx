'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useYearn } from '@/hooks/useYearn'
import { YearnShaper } from '@/components/reader/YearnShaper'
import { StoryReader } from '@/components/reader/StoryReader'
import { UpgradePrompt } from '@/components/billing/UpgradePrompt'
import { LipBiteRating } from '@/components/reader/LipBiteRating'
import type { ExplicitnessLevel, DesireProfile, ParticipantMode } from '@/lib/prompt-engine'
import type { GenerateParams } from '@/hooks/useYearn'

export default function ReadPage() {
  const { session } = useAuth()
  const authToken   = session?.access_token ?? null

  const { state, generate, cancel, reset, adjustExplicitness, midReadGenerate } = useYearn(authToken)

  const [currentExplicitness, setCurrentExplicitness] = useState<ExplicitnessLevel>(2)
  const [lastParams, setLastParams]                    = useState<GenerateParams | null>(null)
  const [profile, setProfile]                         = useState<DesireProfile | null>(null)
  const [isPro, setIsPro]                             = useState(false)
  const [showRating, setShowRating]                   = useState(false)
  const [hidden, setHidden]                           = useState(false)

  // Fetch profile + subscription status on mount
  useEffect(() => {
    if (!authToken) return
    Promise.all([
      fetch('/api/profile', { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json()),
      fetch('/api/billing/status', { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json()).catch(() => ({})),
    ]).then(([{ profile: p }, billing]) => {
      if (p) setProfile(p)
      if (billing?.tier === 'pro' && billing?.status === 'active') setIsPro(true)
    }).catch(() => {})
  }, [authToken])

  // Show rating screen when generation completes
  useEffect(() => {
    if (state.status === 'done') {
      setShowRating(true)
    }
  }, [state.status])

  const defaultMode   = (profile?.participant_mode as ParticipantMode | undefined) ?? 'participant'
  // Default dial to last-used explicitness level; fall back to Sensual (2) for new users
  const defaultLevel  = ((profile as (DesireProfile & { last_explicitness_used?: number }) | null)?.last_explicitness_used as ExplicitnessLevel | undefined) ?? 2
  const defaultLength = ((profile as (DesireProfile & { last_length_mins_used?: number }) | null)?.last_length_mins_used) ?? 10

  function handleGenerate(params: GenerateParams) {
    setCurrentExplicitness(params.explicitness)
    setLastParams(params)
    setShowRating(false)
    generate(params)

    // Persist last-used explicitness, mode, and length to profile
    if (authToken) {
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          last_explicitness_used: params.explicitness,
          last_mode_used:         params.participant_mode_override ?? defaultMode,
          last_length_mins_used:  params.length_mins,
        }),
      }).catch(() => {})
    }
  }

  function handleAdjustExplicitness(level: ExplicitnessLevel) {
    setCurrentExplicitness(level)
    adjustExplicitness(level)
  }

  function handleMidReadExplicitnessChange(
    frozenText: string,
    newLevel: ExplicitnessLevel,
    prevLevel: ExplicitnessLevel,
  ) {
    setCurrentExplicitness(newLevel)
    if (authToken) {
      fetch('/api/profile/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          event: 'midread_explicitness_change',
          data: {
            from_level:         prevLevel,
            to_level:           newLevel,
            read_progress_pct:  lastParams
              ? Math.round((frozenText.length / Math.max(state.text.length, 1)) * 100)
              : null,
          },
          timestamp: Date.now(),
        }),
        keepalive: true,
      }).catch(() => {})
    }
    if (lastParams) {
      midReadGenerate(frozenText, newLevel, prevLevel, lastParams)
    }
  }

  function handleReset() {
    setCurrentExplicitness(defaultLevel)
    setShowRating(false)
    reset()
  }

  const isIdle     = state.status === 'idle'
  const isLimitHit = state.status === 'error' && state.error === 'free_limit_reached'

  return (
    <main>
      {isIdle && (
        <YearnShaper
          onGenerate={handleGenerate}
          defaultMode={defaultMode}
          defaultLevel={defaultLevel}
          defaultLength={defaultLength}
          authToken={authToken}
        />
      )}

      {isLimitHit && (
        <UpgradePrompt
          authToken={authToken}
          onDismiss={handleReset}
        />
      )}

      {!isIdle && !isLimitHit && (
        <StoryReader
          state={state}
          onCancel={cancel}
          onReset={handleReset}
          onAdjustExplicitness={handleAdjustExplicitness}
          onMidReadExplicitnessChange={handleMidReadExplicitnessChange}
          currentExplicitness={currentExplicitness}
          authToken={authToken}
          isPro={isPro}
          generationMeta={lastParams ? {
            setting:      lastParams.setting,
            explicitness: lastParams.explicitness,
            length_mins:  lastParams.length_mins,
          } : undefined}
        />
      )}

      {showRating && state.status === 'done' && (
        <LipBiteRating
          authToken={authToken}
          sessionCount={0}
          outfit={lastParams?.outfit}
          onDismiss={() => setShowRating(false)}
        />
      )}

      {/* Emergency hide button — always-visible, only when a story is present */}
      {!isIdle && (
        <button
          onClick={() => setHidden(true)}
          className="fixed bottom-6 right-5 z-40 w-10 h-10 flex items-center justify-center text-gray-900/20 hover:text-gray-900/40 transition-colors"
          aria-label="Hide story"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        </button>
      )}

      {/* Emergency hide overlay — plain white, instant, tap to return */}
      {hidden && (
        <div
          className="fixed inset-0 z-50 bg-white flex items-center justify-center cursor-pointer"
          onClick={() => setHidden(false)}
        >
          <p className="text-gray-900/20 text-xs tracking-widest uppercase select-none">Tap to return</p>
        </div>
      )}
    </main>
  )
}
