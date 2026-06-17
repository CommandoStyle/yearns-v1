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
          <h1 className="font-serif text-4xl text-gray-900 leading-snug">
            Who do you want<br />to be with?
          </h1>
          <p className="text-gray-900/50 font-light leading-relaxed">
            Describe in a few words. There are no wrong answers.
          </p>
        </div>

        <div className="space-y-1">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value.slice(0, 120))}
            placeholder={EXAMPLES[exampleIndex]}
            rows={3}
            className="w-full bg-transparent border-b border-gray-900/25 focus:border-gray-600 outline-none text-gray-900 text-xl font-serif py-3 text-center placeholder:text-gray-900/15 resize-none transition-colors duration-200 leading-relaxed"
          />
          <p className="text-right text-gray-900/25 text-xs">
            {value.length}/120
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="px-5 py-4 text-gray-900/35 hover:text-gray-900/60 text-sm transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => onNext(value.trim())}
            className="flex-1 py-4 border border-gray-600/50 text-gray-600 font-light tracking-widest text-xs uppercase hover:bg-gray-600/8 transition-all duration-200"
          >
            {value.trim() ? 'Continue' : 'Skip for now'}
          </button>
        </div>

      </div>
    </div>
  )
}
