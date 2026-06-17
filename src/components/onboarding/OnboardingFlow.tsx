'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NameStep }    from './steps/NameStep'
import { GenreStep }   from './steps/GenreStep'
import { FeelStep }    from './steps/FeelStep'
import { DesireStep }  from './steps/DesireStep'
import { SettingStep } from './steps/SettingStep'
import { GeneratingScreen } from './GeneratingScreen'
import { useProfile } from '@/hooks/useProfile'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingData {
  display_name:       string
  genres:             string[]   // ordered: first = highest weight
  emotional_register: string[]   // ordered: first = primary
  desire_targets:     string
  settings:           string[]   // ordered: first = preferred
}

const EMPTY: OnboardingData = {
  display_name:       '',
  genres:             [],
  emotional_register: [],
  desire_targets:     '',
  settings:           [],
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
            i < current ? 'bg-yearns-gold' : 'bg-yearns-cream/20'
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

  async function handleComplete(finalData: OnboardingData) {
    setSaving(true)
    setError(false)

    const success = await update(
      {
        display_name:       finalData.display_name   || undefined,
        genre_weights:      finalData.genres.length   > 0 ? genreWeights(finalData.genres)     : undefined,
        emotional_register: finalData.emotional_register.length > 0 ? finalData.emotional_register : undefined,
        desire_targets:     finalData.desire_targets || undefined,
        setting_preference: finalData.settings.length > 0 ? settingWeights(finalData.settings) : undefined,
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

  const TOTAL = 5

  switch (step) {
    case 1:
      return (
        <>
          <ProgressDots total={TOTAL} current={1} />
          <NameStep
            initialValue={data.display_name}
            onNext={display_name => { patch({ display_name }); setStep(2) }}
          />
        </>
      )

    case 2:
      return (
        <>
          <ProgressDots total={TOTAL} current={2} />
          <GenreStep
            initialValue={data.genres}
            onNext={genres => { patch({ genres }); setStep(3) }}
            onBack={() => setStep(1)}
          />
        </>
      )

    case 3:
      return (
        <>
          <ProgressDots total={TOTAL} current={3} />
          <FeelStep
            initialValue={data.emotional_register}
            onNext={emotional_register => { patch({ emotional_register }); setStep(4) }}
            onBack={() => setStep(2)}
          />
        </>
      )

    case 4:
      return (
        <>
          <ProgressDots total={TOTAL} current={4} />
          <DesireStep
            initialValue={data.desire_targets}
            onNext={desire_targets => { patch({ desire_targets }); setStep(5) }}
            onBack={() => setStep(3)}
          />
        </>
      )

    case 5:
      return (
        <>
          <ProgressDots total={TOTAL} current={5} />
          <SettingStep
            initialValue={data.settings}
            onNext={settings => {
              const finalData = { ...data, settings }
              patch({ settings })
              handleComplete(finalData)
            }}
            onBack={() => setStep(4)}
          />
          {error && (
            <p className="fixed bottom-6 inset-x-0 text-center text-yearns-cream/50 text-sm">
              Something went wrong. Try again.
            </p>
          )}
        </>
      )

    default:
      return null
  }
}
