'use client'

import type { AgeBand } from '@/lib/age-registers'

const OPTIONS: { value: AgeBand; label: string }[] = [
  { value: '18_24', label: '18–24' },
  { value: '25_34', label: '25–34' },
  { value: '35_44', label: '35–44' },
  { value: '45_54', label: '45–54' },
  { value: '55_64', label: '55–64' },
  { value: '65_plus', label: '65+' },
]

interface AgeBandStepProps {
  onNext: (ageBand: AgeBand) => void
  onBack: () => void
}

export function AgeBandStep({ onNext, onBack }: AgeBandStepProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-16">
      <div className="w-full max-w-sm space-y-10 animate-fade-up">

        <div className="space-y-2">
          <h2 className="font-serif text-3xl text-gray-900 tracking-tight">
            How old are you?
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Stories feel different at different stages of life. This shapes the tone — nothing more.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onNext(opt.value)}
              className="py-3 border border-gray-900/15 text-gray-600 text-sm font-light hover:border-gray-600/50 hover:text-gray-900 transition-all duration-200"
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onNext('25_34')}
          className="text-gray-300 text-xs tracking-widest uppercase hover:text-gray-500 transition-colors duration-200"
        >
          Skip
        </button>

        <button
          onClick={onBack}
          className="block text-gray-300 text-xs hover:text-gray-500 transition-colors duration-200"
        >
          ← back
        </button>

      </div>
    </div>
  )
}
