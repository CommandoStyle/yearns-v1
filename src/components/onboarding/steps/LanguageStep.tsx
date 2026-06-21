'use client'

import { useState } from 'react'
import type { SupportedLanguage } from '@/lib/prompt-engine'

const LANGUAGES: { key: SupportedLanguage; label: string; native: string; line: string }[] = [
  { key: 'en', label: 'English',  native: 'English',   line: 'The default. Craft-tuned for literary quality.' },
  { key: 'fr', label: 'French',   native: 'Français',  line: 'Charged restraint. The Colette tradition.'       },
  { key: 'it', label: 'Italian',  native: 'Italiano',  line: 'Warmth, directness, operatic intensity.'         },
  { key: 'ja', label: 'Japanese', native: '日本語',    line: 'Atmosphere and suggestion over explicit naming.' },
  { key: 'es', label: 'Spanish',  native: 'Español',   line: 'Passionate and direct. Regional variation.'      },
  { key: 'de', label: 'German',   native: 'Deutsch',   line: 'Cumulative sentences that mirror tension.'       },
]

interface LanguageStepProps {
  initialValue: SupportedLanguage
  onNext: (language: SupportedLanguage) => void
  onBack: () => void
}

export function LanguageStep({ initialValue, onNext, onBack }: LanguageStepProps) {
  const [selected, setSelected] = useState<SupportedLanguage>(initialValue)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-16 pt-24">
      <div className="w-full max-w-lg space-y-8 animate-fade-up">

        <div className="space-y-3 text-center">
          <h1 className="font-serif text-4xl text-gray-900 leading-snug">
            Which language?
          </h1>
          <p className="text-gray-900/50 font-light">
            Your stories will be written in this language.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {LANGUAGES.map(({ key, label, native, line }) => {
            const active = selected === key
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`relative p-4 text-left transition-all duration-200 ${
                  active
                    ? 'border border-gray-600/70 bg-gray-600/5'
                    : 'border border-gray-900/12 hover:border-gray-900/25'
                }`}
              >
                <p className={`font-serif text-lg transition-colors ${active ? 'text-gray-600' : 'text-gray-900'}`}>
                  {native}
                </p>
                <p className="mt-0.5 text-gray-900/35 text-[11px] font-light">{label}</p>
                <p className="mt-1.5 text-gray-900/40 text-xs font-light leading-relaxed">{line}</p>
                {(key === 'es' || key === 'de') && (
                  <p className="mt-1 text-gray-900/25 text-[10px] font-light italic">Early access</p>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onBack}
            className="px-5 py-4 text-gray-900/35 hover:text-gray-900/60 text-sm transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => onNext(selected)}
            className="flex-1 py-4 border border-gray-600/50 text-gray-600 font-light tracking-widest text-xs uppercase hover:bg-gray-600/8 transition-all duration-200"
          >
            Continue
          </button>
        </div>

      </div>
    </div>
  )
}
