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

  const defaultMode  = (profile?.participant_mode as ParticipantMode | undefined) ?? 'participant'
  // Default dial to last-used explicitness level; fall back to Sensual (2) for new users
  const defaultLevel = ((profile as (DesireProfile & { last_explicitness_used?: number }) | null)?.last_explicitness_used as ExplicitnessLevel | undefined) ?? 2

  function handleGenerate(params: GenerateParams) {
    setCurrentExplicitness(params.explicitness)
    setLastParams(params)
    setShowRating(false)
    generate(params)

    // Persist last-used explicitness level to profile
    if (authToken) {
      fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ last_explicitness_used: params.explicitness }),
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
          onDismiss={() => setShowRating(false)}
        />
      )}
    </main>
  )
}
