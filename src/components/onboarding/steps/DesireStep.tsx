'use client'

import { useState } from 'react'

const EXAMPLES = [
  'a man, powerful, a little older',
  'a woman, dangerous, unknowable',
  'someone I shouldn\'t want',
  'a stranger — no history, no rules',
]

interface DesireStepProps {
  initialValue: string
  onNext: (desire: string) => void
  onBack: () => void
}

export function DesireStep({ initialValue, onNext, onBack }: DesireStepProps) {
  const [value, setValue] = useState(initialValue)
  const [exampleIndex] = useState(() => Math.floor(Math.random() * EXAMPLES.length))

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 pb-16 pt-24">
      <div className="w-full max-w-sm space-y-10 animate-fade-up">

        <div className="space-y-4 text-center">
          <h1 className="font-serif text-4xl text-yearns-cream leading-snug">
            Who do you want<br />to be with?
          </h1>
          <p className="text-yearns-cream/50 font-light leading-relaxed">
            Describe in a few words. There are no wrong answers.
          </p>
        </div>

        <div className="space-y-1">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value.slice(0, 120))}
            placeholder={EXAMPLES[exampleIndex]}
            rows={3}
            className="w-full bg-transparent border-b border-yearns-cream/25 focus:border-yearns-gold outline-none text-yearns-cream text-xl font-serif py-3 text-center placeholder:text-yearns-cream/15 resize-none transition-colors duration-200 leading-relaxed"
          />
          <p className="text-right text-yearns-cream/25 text-xs">
            {value.length}/120
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-5 py-4 text-yearns-cream/35 hover:text-yearns-cream/60 text-sm transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => onNext(value.trim())}
            className="flex-1 py-4 border border-yearns-gold/50 text-yearns-gold font-light tracking-widest text-xs uppercase hover:bg-yearns-gold/8 transition-all duration-200"
          >
            {value.trim() ? 'Continue' : 'Skip for now'}
          </button>
        </div>

      </div>
    </div>
  )
}
