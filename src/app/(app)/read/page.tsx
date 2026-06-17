'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useYearn } from '@/hooks/useYearn'
import { YearnControls } from '@/components/reader/YearnControls'
import { StoryReader } from '@/components/reader/StoryReader'
import { UpgradePrompt } from '@/components/billing/UpgradePrompt'
import type { ExplicitnessLevel } from '@/lib/prompt-engine'

export default function ReadPage() {
  const { session } = useAuth()
  const authToken   = session?.access_token ?? null

  const { state, generate, cancel, reset, adjustExplicitness } = useYearn(authToken)

  const [currentExplicitness, setCurrentExplicitness] = useState<ExplicitnessLevel>(2)

  function handleAdjustExplicitness(level: ExplicitnessLevel) {
    setCurrentExplicitness(level)
    adjustExplicitness(level)
  }

  function handleReset() {
    setCurrentExplicitness(2)
    reset()
  }

  const isIdle       = state.status === 'idle'
  const isLimitHit   = state.status === 'error' && state.error === 'free_limit_reached'

  // Pass the yearn error through to controls when user resets after a non-upgrade error
  const controlsErrorCode = isIdle ? null : null  // controls only shown when idle

  return (
    <main>
      {isIdle && (
        <YearnControls
          onGenerate={params => {
            setCurrentExplicitness(params.explicitness)
            generate(params)
          }}
          errorCode={controlsErrorCode}
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
    </main>
  )
}
