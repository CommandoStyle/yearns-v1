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
          <h1 className="font-serif text-4xl text-gray-900 leading-snug">
            What should we<br />call you?
          </h1>
          <p className="text-gray-900/50 font-light leading-relaxed">
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
            className="w-full bg-transparent border-b border-gray-900/25 focus:border-gray-600 outline-none text-gray-900 text-2xl font-serif py-3 text-center placeholder:text-gray-900/15 transition-colors duration-200"
          />
          <p className="text-right text-gray-900/25 text-xs pr-0.5">
            {name.length}/24
          </p>
        </div>

        <button
          onClick={() => onNext(trimmed)}
          disabled={trimmed.length === 0}
          className="w-full py-4 border border-gray-600/50 text-gray-600 font-light tracking-widest text-xs uppercase hover:bg-gray-600/8 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
        >
          Continue
        </button>

      </div>
    </div>
  )
}
