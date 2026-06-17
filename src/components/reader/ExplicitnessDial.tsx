'use client'

import type { ExplicitnessLevel } from '@/lib/prompt-engine'

const LEVELS: { level: ExplicitnessLevel; label: string; short: string }[] = [
  { level: 1, label: 'Suggestive',    short: 'I' },
  { level: 2, label: 'Sensual',       short: 'II' },
  { level: 3, label: 'Explicit',      short: 'III' },
  { level: 4, label: 'Unrestricted',  short: 'IV' },
]

interface ExplicitnessDialProps {
  value:     ExplicitnessLevel
  onChange:  (level: ExplicitnessLevel) => void
  disabled?: boolean
  // compact = in-reader floating bar; default = full-width pre-generation
  compact?:  boolean
}

export function ExplicitnessDial({
  value, onChange, disabled, compact = false,
}: ExplicitnessDialProps) {
  return (
    <div
      className={`flex ${compact ? 'gap-1' : 'w-full border-t border-gray-900/10'}`}
      role="radiogroup"
      aria-label="Explicitness level"
    >
      {LEVELS.map(({ level, label, short }) => {
        const active = value === level
        return (
          <button
            key={level}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(level)}
            disabled={disabled}
            className={[
              'transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed',
              compact
                ? `px-3 py-1.5 rounded-sm text-xs ${active ? 'bg-gray-600/15 text-gray-600' : 'text-gray-900/30 hover:text-gray-900/55'}`
                : `flex-1 py-3 text-xs tracking-wide border-t-2 -mt-px ${active ? 'border-gray-600 text-gray-600' : 'border-transparent text-gray-900/30 hover:text-gray-900/55'}`,
            ].join(' ')}
          >
            {compact ? short : label}
          </button>
        )
      })}
    </div>
  )
}
