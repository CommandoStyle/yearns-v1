'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AgeStep }      from './steps/AgeStep'
import { NameStep }     from './steps/NameStep'
import { GenreStep }    from './steps/GenreStep'
import { FeelStep }     from './steps/FeelStep'
import { DesireStep }   from './steps/DesireStep'
import { SettingStep }  from './steps/SettingStep'
import { LanguageStep } from './steps/LanguageStep'
import type { SupportedLanguage } from '@/lib/prompt-engine'
import { GeneratingScreen } from './GeneratingScreen'
import { useProfile } from '@/hooks/useProfile'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingData {
  display_name:       string
  genres:             string[]
  emotional_register: string[]
  desire_targets:     string
  settings:           string[]
  language:           SupportedLanguage
}

const EMPTY: OnboardingData = {
  display_name:       '',
  genres:             [],
  emotional_register: [],
  desire_targets:     '',
  settings:           [],
  language:           'en',
}

interface OnboardingFlowProps {
  authToken: string
}

// ─── Weight helpers ───────────────────────────────────────────────────────────

function genreWeights(genres: string[]): Record<string, number> {
  const w = [0.9, 0.6, 0.3]
  return Object.fromEntries(genres.map((g, i) => [g, w[i] ?? 0.3]))
}

function settingWeights(settings: string[]): Record<string, number> {
  const w = [0.8, 0.5]
  return Object.fromEntries(settings.map((s, i) => [s, w[i] ?? 0.5]))
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="fixed top-8 inset-x-0 flex justify-center gap-2 z-10 pointer-events-none">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
            i < current ? 'bg-gray-600' : 'bg-gray-900/20'
          }`}
        />
      ))}
    </div>
  )
}

// ─── Flow ─────────────────────────────────────────────────────────────────────

export function OnboardingFlow({ authToken }: OnboardingFlowProps) {
  const [step, setStep]     = useState(1)
  const [data, setData]     = useState<OnboardingData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(false)
  const { update }          = useProfile()
  const router              = useRouter()

  function patch(partial: Partial<OnboardingData>) {
    setData(d => ({ ...d, ...partial }))
  }

  // Step 1: age gate — call server to mark age_verified before proceeding
  async function handleAgeConfirmed(_dob: string) {
    await fetch('/api/auth/verify-age', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    // Proceed regardless of result — failure is non-fatal for the flow.
    // The generate endpoint will still enforce age_verified server-side.
    setStep(2)
  }

  async function handleComplete(finalData: OnboardingData) {
    setSaving(true)
    setError(false)

    const success = await update(
      {
        display_name:        finalData.display_name   || undefined,
        genre_weights:       finalData.genres.length   > 0 ? genreWeights(finalData.genres)     : undefined,
        emotional_register:  finalData.emotional_register.length > 0 ? finalData.emotional_register : undefined,
        desire_targets:      finalData.desire_targets || undefined,
        setting_preference:  finalData.settings.length > 0 ? settingWeights(finalData.settings) : undefined,
        language:            finalData.language,
        onboarding_complete: true,
      },
      authToken,
    )

    if (success) {
      router.push('/read')
    } else {
      setSaving(false)
      setError(true)
    }
  }

  if (saving) return <GeneratingScreen />

  const TOTAL = 7  // age + name + genre + feel + desire + setting + language

  switch (step) {
    case 1:
      return (
        <>
          <ProgressDots total={TOTAL} current={1} />
          <AgeStep onNext={handleAgeConfirmed} />
        </>
      )

    case 2:
      return (
        <>
          <ProgressDots total={TOTAL} current={2} />
          <NameStep
            initialValue={data.display_name}
            onNext={display_name => { patch({ display_name }); setStep(3) }}
          />
        </>
      )

    case 3:
      return (
        <>
          <ProgressDots total={TOTAL} current={3} />
          <GenreStep
            initialValue={data.genres}
            onNext={genres => { patch({ genres }); setStep(4) }}
            onBack={() => setStep(2)}
          />
        </>
      )

    case 4:
      return (
        <>
          <ProgressDots total={TOTAL} current={4} />
          <FeelStep
            initialValue={data.emotional_register}
            onNext={emotional_register => { patch({ emotional_register }); setStep(5) }}
            onBack={() => setStep(3)}
          />
        </>
      )

    case 5:
      return (
        <>
          <ProgressDots total={TOTAL} current={5} />
          <DesireStep
            initialValue={data.desire_targets}
            onNext={desire_targets => { patch({ desire_targets }); setStep(6) }}
            onBack={() => setStep(4)}
          />
        </>
      )

    case 6:
      return (
        <>
          <ProgressDots total={TOTAL} current={6} />
          <SettingStep
            initialValue={data.settings}
            onNext={settings => { patch({ settings }); setStep(7) }}
            onBack={() => setStep(5)}
          />
        </>
      )

    case 7:
      return (
        <>
          <ProgressDots total={TOTAL} current={7} />
          <LanguageStep
            initialValue={data.language}
            onNext={language => {
              const finalData = { ...data, language }
              patch({ language })
              handleComplete(finalData)
            }}
            onBack={() => setStep(6)}
          />
          {error && (
            <p className="fixed bottom-6 inset-x-0 text-center text-gray-900/50 text-sm">
              Something went wrong. Try again.
            </p>
          )}
        </>
      )

    default:
      return null
  }
}
