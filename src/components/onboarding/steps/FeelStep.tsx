'use client'

import { useState } from 'react'

const REGISTERS = [
  { key: 'desired',     label: 'Desired',     line: 'Chosen. Seen. Pursued with intention.' },
  { key: 'powerful',    label: 'Powerful',    line: 'In command. You set the terms.' },
  { key: 'surrendered', label: 'Surrendered', line: 'Giving yourself over — safely, completely.' },
  { key: 'adored',      label: 'Adored',      line: 'Treasured. Handled with reverence.' },
  { key: 'forbidden',   label: 'Forbidden',   line: 'A line being crossed. The thrill of it.' },
  { key: 'dangerous',   label: 'Dangerous',   line: 'Something at stake. Unpredictable. Edge.' },
  { key: 'seen',        label: 'Seen',        line: 'Known completely — every contradiction.' },
  { key: 'surprised',   label: 'Surprised',   line: 'Taken somewhere unexpected.' },
] as const

interface FeelStepProps {
  initialValue: string[]
  onNext: (registers: string[]) => void
  onBack: () => void
}

export function FeelStep({ initialValue, onNext, onBack }: FeelStepProps) {
  const [selected, setSelected] = useState<string[]>(initialValue)

  function toggle(key: string) {
    setSelected(prev =>
      prev.includes(key)
        ? prev.filter(r => r !== key)
        : prev.length < 2 ? [...prev, key] : prev,
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-16 pt-24">
      <div className="w-full max-w-lg space-y-8 animate-fade-up">

        <div className="space-y-3 text-center">
          <h1 className="font-serif text-4xl text-yearns-cream leading-snug">
            How do you want<br />to feel?
          </h1>
          <p className="text-yearns-cream/50 font-light">
            Choose one or two. The first is what we'll lean into.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {REGISTERS.map(({ key, label, line }) => {
            const rank = selected.indexOf(key) + 1
            const active = rank > 0
            const isPrimary = rank === 1
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`relative p-4 text-left transition-all duration-200 ${
                  active
                    ? 'border border-yearns-gold/70 bg-yearns-gold/5'
                    : 'border border-yearns-cream/12 hover:border-yearns-cream/25'
                }`}
              >
                {active && (
                  <span className="absolute top-2.5 right-3 text-yearns-gold/50 text-xs">
                    {isPrimary ? 'primary' : 'secondary'}
                  </span>
                )}
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
            disabled={selected.length === 0}
            className="flex-1 py-4 border border-yearns-gold/50 text-yearns-gold font-light tracking-widest text-xs uppercase hover:bg-yearns-gold/8 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-200"
          >
            Continue
          </button>
        </div>

      </div>
    </div>
  )
}
