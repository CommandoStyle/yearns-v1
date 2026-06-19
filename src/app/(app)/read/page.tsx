'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useYearn } from '@/hooks/useYearn'
import { YearnControls } from '@/components/reader/YearnControls'
import { StoryReader } from '@/components/reader/StoryReader'
import { UpgradePrompt } from '@/components/billing/UpgradePrompt'
import { PreGenerationPanel } from '@/components/reader/PreGenerationPanel'
import type { ExplicitnessLevel, Genre, DesireProfile } from '@/lib/prompt-engine'
import type { GenerateParams } from '@/hooks/useYearn'

export default function ReadPage() {
  const { session } = useAuth()
  const authToken   = session?.access_token ?? null

  const { state, generate, cancel, reset, adjustExplicitness } = useYearn(authToken)

  const [currentExplicitness, setCurrentExplicitness] = useState<ExplicitnessLevel>(2)
  const [pendingParams, setPendingParams]              = useState<GenerateParams | null>(null)
  const [profile, setProfile]                         = useState<DesireProfile | null>(null)

  // Fetch profile once for spark sorting + default participant mode
  useEffect(() => {
    if (!authToken) return
    fetch('/api/profile', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(({ profile: p }) => { if (p) setProfile(p) })
      .catch(() => {})
  }, [authToken])

  const topGenre = getTopGenre(profile?.genre_weights)
  const defaultMode = profile?.participant_mode ?? 'participant'

  function handleRequestGenerate(params: GenerateParams) {
    setCurrentExplicitness(params.explicitness)
    setPendingParams(params)
  }

  function handlePanelConfirm(params: GenerateParams) {
    setPendingParams(null)
    generate(params)
  }

  function handlePanelSkip() {
    if (!pendingParams) return
    const params = pendingParams
    setPendingParams(null)
    generate(params)
  }

  function handleAdjustExplicitness(level: ExplicitnessLevel) {
    setCurrentExplicitness(level)
    adjustExplicitness(level)
  }

  function handleReset() {
    setCurrentExplicitness(2)
    setPendingParams(null)
    reset()
  }

  const isIdle     = state.status === 'idle'
  const isLimitHit = state.status === 'error' && state.error === 'free_limit_reached'

  return (
    <main>
      {isIdle && !pendingParams && (
        <YearnControls
          onGenerate={handleRequestGenerate}
          defaultLevel={currentExplicitness}
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
          currentExplicitness={currentExplicitness}
        />
      )}

      {pendingParams && (
        <PreGenerationPanel
          baseParams={pendingParams}
          topGenre={topGenre}
          defaultMode={defaultMode}
          onConfirm={handlePanelConfirm}
          onSkip={handlePanelSkip}
          authToken={authToken}
        />
      )}
    </main>
  )
}

function getTopGenre(weights?: Partial<Record<Genre, number>>): Genre | undefined {
  if (!weights) return undefined
  const entries = Object.entries(weights) as [Genre, number][]
  if (!entries.length) return undefined
  return entries.sort(([, a], [, b]) => b - a)[0][0]
}
