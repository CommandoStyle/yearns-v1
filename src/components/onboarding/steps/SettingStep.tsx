'use client'

import { useState } from 'react'

const SETTINGS = [
  { key: 'bedroom',    label: 'Bedroom',    line: 'Intimate. Familiar. The permission of home.' },
  { key: 'hotel',      label: 'Hotel',      line: 'Anonymous. Temporary. Clean sheets, no history.' },
  { key: 'travelling', label: 'Travelling', line: 'In transit. Suspended. Slightly unreal.' },
  { key: 'outdoors',   label: 'Outdoors',   line: 'Space, nature, exposure. Body meets world.' },
  { key: 'urban',      label: 'Urban',      line: 'The private, carved from the public.' },
  { key: 'workplace',  label: 'Workplace',  line: 'Familiar rules. The charge of breaking them.' },
] as const

interface SettingStepProps {
  initialValue: string[]
  onNext: (settings: string[]) => void
  onBack: () => void
}

export function SettingStep({ initialValue, onNext, onBack }: SettingStepProps) {
  const [selected, setSelected] = useState<string[]>(initialValue)

  function toggle(key: string) {
    setSelected(prev =>
      prev.includes(key)
        ? prev.filter(s => s !== key)
        : prev.length < 2 ? [...prev, key] : prev,
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-16 pt-24">
      <div className="w-full max-w-lg space-y-8 animate-fade-up">

        <div className="space-y-3 text-center">
          <h1 className="font-serif text-4xl text-yearns-cream leading-snug">
            Where does it happen?
          </h1>
          <p className="text-yearns-cream/50 font-light">
            Pick your favourite or two. We'll surprise you if you leave it open.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {SETTINGS.map(({ key, label, line }) => {
            const active = selected.includes(key)
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`p-4 text-left transition-all duration-200 ${
                  active
                    ? 'border border-yearns-gold/70 bg-yearns-gold/5'
                    : 'border border-yearns-cream/12 hover:border-yearns-cream/25'
                }`}
              >
                <p className={`font-serif text-lg transition-colors ${active ? 'text-yearns-gold' : 'text-yearns-cream'}`}>
                  {label}
                </p>
                <p className="mt-1 text-yearns-cream/40 text-xs font-light leading-relaxed">
                  {line}
                </p>
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onBack}
            className="px-5 py-4 text-yearns-cream/35 hover:text-yearns-cream/60 text-sm transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => onNext(selected)}
            className="flex-1 py-4 border border-yearns-gold/50 text-yearns-gold font-light tracking-widest text-xs uppercase hover:bg-yearns-gold/8 transition-all duration-200"
          >
            {selected.length > 0 ? 'Continue' : 'Surprise me'}
          </button>
        </div>

      </div>
    </div>
  )
}
