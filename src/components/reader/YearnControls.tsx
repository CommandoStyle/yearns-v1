'use client'

import { useState } from 'react'
import { ExplicitnessDial } from './ExplicitnessDial'
import type { ExplicitnessLevel, SettingType } from '@/lib/prompt-engine'
import type { GenerateParams } from '@/hooks/useYearn'
import type { YearnErrorCode } from '@/hooks/useYearn'

// ─── Config ───────────────────────────────────────────────────────────────────

const SETTINGS: { key: SettingType; label: string }[] = [
  { key: 'bedroom',    label: 'Bedroom'   },
  { key: 'hotel',      label: 'Hotel'     },
  { key: 'travelling', label: 'Travelling'},
  { key: 'outdoors',   label: 'Outdoors'  },
  { key: 'urban',      label: 'Urban'     },
  { key: 'workplace',  label: 'Workplace' },
]

const LENGTHS: { mins: number; label: string }[] = [
  { mins: 5,  label: '5 min'  },
  { mins: 10, label: '10 min' },
  { mins: 15, label: '15 min' },
  { mins: 20, label: '20 min' },
  { mins: 30, label: '30 min' },
]

const ERROR_MESSAGES: Partial<Record<YearnErrorCode, string>> = {
  free_limit_reached:   "You've read all your free Yearns this month. Upgrade to continue.",
  rate_limited:         'Take a breath — try again in a little while.',
  content_policy:       'Try adjusting your settings and generating again.',
  output_policy:        "This one didn't quite work. Try again.",
  stream_error:         'Something interrupted your Yearn. Try again.',
  network_error:        'Check your connection and try again.',
  age_verification_required: 'Age verification is required before your first Yearn.',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface YearnControlsProps {
  onGenerate:   (params: GenerateParams) => void
  errorCode?:   YearnErrorCode | null
  defaultLevel?: ExplicitnessLevel
}

export function YearnControls({
  onGenerate,
  errorCode,
  defaultLevel = 2,
}: YearnControlsProps) {
  const [explicitness, setExplicitness] = useState<ExplicitnessLevel>(defaultLevel)
  const [setting, setSetting]           = useState<SettingType>('bedroom')
  const [lengthMins, setLengthMins]     = useState(10)

  function handleGenerate() {
    onGenerate({ explicitness, setting, length_mins: lengthMins })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-16">
      <div className="w-full max-w-md space-y-10 animate-fade-up">

        {/* Brand */}
        <div className="text-center space-y-1">
          <h1 className="font-serif text-4xl text-gray-900 tracking-tight">
            Yearns
          </h1>
          <p className="text-gray-600/70 text-xs tracking-widest uppercase font-light">
            Your story awaits
          </p>
        </div>

        {/* Error */}
        {errorCode && ERROR_MESSAGES[errorCode] && (
          <p className="text-center text-gray-900/50 text-sm border border-gray-900/10 px-4 py-3">
            {ERROR_MESSAGES[errorCode]}
          </p>
        )}

        {/* How long */}
        <div className="space-y-3">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">
            How long?
          </p>
          <div className="flex gap-2">
            {LENGTHS.map(({ mins, label }) => (
              <button
                key={mins}
                onClick={() => setLengthMins(mins)}
                className={`flex-1 py-2.5 text-xs transition-all duration-200 ${
                  lengthMins === mins
                    ? 'border border-gray-600/70 text-gray-600'
                    : 'border border-gray-900/12 text-gray-900/40 hover:border-gray-900/25 hover:text-gray-900/65'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Where */}
        <div className="space-y-3">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">
            Where?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SETTINGS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSetting(key)}
                className={`py-2.5 text-xs transition-all duration-200 ${
                  setting === key
                    ? 'border border-gray-600/70 text-gray-600'
                    : 'border border-gray-900/12 text-gray-900/40 hover:border-gray-900/25 hover:text-gray-900/65'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Explicitness */}
        <div className="space-y-3">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">
            How explicit?
          </p>
          <ExplicitnessDial value={explicitness} onChange={setExplicitness} />
        </div>

        {/* CTA */}
        <button
          onClick={handleGenerate}
          className="w-full py-5 border border-gray-600/50 text-gray-600 font-serif text-lg tracking-wide hover:bg-gray-600/8 transition-all duration-300"
        >
          Write my Yearn
        </button>

      </div>
    </div>
  )
}
