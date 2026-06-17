'use client'

import { useState } from 'react'

const GENRES = [
  { key: 'contemporary', label: 'Contemporary', line: 'Ordinary life. Extraordinary charge.' },
  { key: 'historical',   label: 'Historical',   line: 'A past era — its tensions, its freedoms.' },
  { key: 'fantasy',      label: 'Fantasy',      line: 'Magic, myth. Worlds with their own rules.' },
  { key: 'scifi',        label: 'Sci-Fi',       line: 'Distance, isolation, and intimacy remade.' },
  { key: 'romantic',     label: 'Romantic',     line: 'Connection is the engine. Feeling, everything.' },
  { key: 'dark',         label: 'Dark',         line: 'Power, shadow, and moral ambiguity.' },
] as const

interface GenreStepProps {
  initialValue: string[]
  onNext:  (genres: string[]) => void
  onBack:  () => void
}

export function GenreStep({ initialValue, onNext, onBack }: GenreStepProps) {
  const [selected, setSelected] = useState<string[]>(initialValue)

  function toggle(key: string) {
    setSelected(prev =>
      prev.includes(key)
        ? prev.filter(g => g !== key)
        : prev.length < 3 ? [...prev, key] : prev,
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-16 pt-24">
      <div className="w-full max-w-lg space-y-8 animate-fade-up">

        <div className="space-y-3 text-center">
          <h1 className="font-serif text-4xl text-gray-900 leading-snug">
            What worlds pull you in?
          </h1>
          <p className="text-gray-900/50 font-light">
            Choose up to three. Your first choice shapes the most.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {GENRES.map(({ key, label, line }) => {
            const rank = selected.indexOf(key) + 1
            const active = rank > 0
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`relative p-4 text-left transition-all duration-200 ${
                  active
                    ? 'border border-gray-600/70 bg-gray-600/5'
                    : 'border border-gray-900/12 hover:border-gray-900/25'
                }`}
              >
                {active && (
                  <span className="absolute top-2.5 right-3 text-gray-600/60 text-xs tabular-nums">
                    {rank}
                  </span>
                )}
                <p className={`font-serif text-lg transition-colors ${active ? 'text-gray-600' : 'text-gray-900'}`}>
                  {label}
                </p>
                <p className="mt-1 text-gray-900/40 text-xs font-light leading-relaxed">
                  {line}
                </p>
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
            disabled={selected.length === 0}
            className="flex-1 py-4 border border-gray-600/50 text-gray-600 font-light tracking-widest text-xs uppercase hover:bg-gray-600/8 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
          >
            Continue
          </button>
        </div>

      </div>
    </div>
  )
}
