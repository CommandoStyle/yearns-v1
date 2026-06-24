'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AgeStep }      from './steps/AgeStep'
import { NameStep }     from './steps/NameStep'
import { AgeBandStep }  from './steps/AgeBandStep'
import { LanguageStep } from './steps/LanguageStep'
import type { SupportedLanguage } from '@/lib/prompt-engine'
import type { AgeBand } from '@/lib/age-registers'
import { GeneratingScreen } from './GeneratingScreen'
import { useProfile } from '@/hooks/useProfile'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingData {
  display_name: string
  age_band:     AgeBand | null
  language:     SupportedLanguage
}

const EMPTY: OnboardingData = {
  display_name: '',
  age_band:     null,
  language:     'en',
}

interface OnboardingFlowProps {
  authToken: string
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
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    })
    setStep(2)
  }

  async function handleComplete(finalData: OnboardingData) {
    setSaving(true)
    setError(false)

    const success = await update(
      {
        display_name:        finalData.display_name || undefined,
        age_band:            finalData.age_band    || undefined,
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

  const TOTAL = 4  // age + name + age band + language

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
          <AgeBandStep
            onNext={age_band => { patch({ age_band }); setStep(4) }}
            onBack={() => setStep(2)}
          />
        </>
      )

    case 4:
      return (
        <>
          <ProgressDots total={TOTAL} current={4} />
          <LanguageStep
            initialValue={data.language}
            onNext={language => {
              const finalData = { ...data, language }
              patch({ language })
              handleComplete(finalData)
            }}
            onBack={() => setStep(3)}
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
