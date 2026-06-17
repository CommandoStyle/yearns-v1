'use client'

import { useState } from 'react'

interface NameStepProps {
  initialValue: string
  onNext: (name: string) => void
}

export function NameStep({ initialValue, onNext }: NameStepProps) {
  const [name, setName] = useState(initialValue)
  const trimmed = name.trim()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 pb-16 pt-24">
      <div className="w-full max-w-sm space-y-12 animate-fade-up">

        <div className="space-y-4 text-center">
          <h1 className="font-serif text-4xl text-yearns-cream leading-snug">
            What should we<br />call you?
          </h1>
          <p className="text-yearns-cream/50 font-light leading-relaxed">
            A first name, a nickname — whatever feels like yours.
          </p>
        </div>

        <div className="space-y-1">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.slice(0, 24))}
            placeholder="Your name"
            autoFocus
            className="w-full bg-transparent border-b border-yearns-cream/25 focus:border-yearns-gold outline-none text-yearns-cream text-2xl font-serif py-3 text-center placeholder:text-yearns-cream/15 transition-colors duration-200"
          />
          <p className="text-right text-yearns-cream/25 text-xs pr-0.5">
            {name.length}/24
          </p>
        </div>

        <button
          onClick={() => onNext(trimmed)}
          disabled={trimmed.length === 0}
          className="w-full py-4 border border-yearns-gold/50 text-yearns-gold font-light tracking-widest text-xs uppercase hover:bg-yearns-gold/8 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
        >
          Continue
        </button>

      </div>
    </div>
  )
}
