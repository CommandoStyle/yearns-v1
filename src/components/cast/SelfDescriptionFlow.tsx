'use client'

// Self-description progressive disclosure (prompt-10, Part 2).
// Three levels — Level 1 is the only mandatory decision point.
// Stopping at Level 1 or 2 is a complete outcome, not partial.
//
// IMPORTANT — build descriptor vocabulary:
// 'slender', 'curvy', 'athletic', 'soft' were chosen provisionally.
// Validate with real users and trainers post-launch before treating
// this word list as final. See prompt-10 spec Part 2 for context.

import { useState } from 'react'
import type { SelfDescriptionFields } from '@/types/cast'

interface SelfDescriptionFlowProps {
  initial:     Partial<SelfDescriptionFields>
  authToken:   string | null
  onSaved?:    (fields: Partial<SelfDescriptionFields>) => void
  onDismissed?: () => void
}

// ─── Vocabulary ───────────────────────────────────────────────────────────────

const HAIR_OPTIONS = [
  'dark', 'brown', 'blonde', 'red', 'auburn', 'silver', 'black', 'grey',
]

const EYE_OPTIONS = [
  'brown', 'blue', 'green', 'hazel', 'grey', 'dark',
]

// Provisional vocabulary — flagged for post-launch validation (see file header).
const BUILD_OPTIONS = [
  'slender', 'curvy', 'athletic', 'soft',
]

// PROVISIONAL — flagged for trainer validation before treating as final.
// Mirror any changes here in CastMemberForm.tsx if that file adds ethnicity chips.
const ETHNICITY_OPTIONS = [
  'Black', 'East Asian', 'South Asian', 'Southeast Asian',
  'Latina', 'Middle Eastern', 'Mixed', 'White',
]

// ─── Chip selector ────────────────────────────────────────────────────────────

function ChipSelector({
  options,
  value,
  onChange,
  skippable = true,
}: {
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
  skippable?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(value === opt ? null : opt)}
          className={`px-3 py-1.5 text-sm border rounded-sm transition-all duration-200 capitalize ${
            value === opt
              ? 'border-gray-600/70 bg-gray-600/5 text-gray-700'
              : 'border-gray-900/12 text-gray-500 hover:border-gray-900/30'
          }`}
        >
          {opt}
        </button>
      ))}
      {skippable && (
        <button
          onClick={() => onChange(null)}
          className={`px-3 py-1.5 text-sm border rounded-sm transition-all duration-200 ${
            value === null
              ? 'border-gray-600/70 bg-gray-600/5 text-gray-700'
              : 'border-gray-900/8 text-gray-400/60 hover:border-gray-900/20'
          }`}
        >
          skip
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SelfDescriptionFlow({
  initial,
  authToken,
  onSaved,
  onDismissed,
}: SelfDescriptionFlowProps) {
  // Level 1: have they opted in?
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(
    initial.hair_colour || initial.eye_colour || initial.build || initial.ethnicity ? 2 : 0
  )

  // Level 2 fields
  const [hairColour, setHairColour] = useState<string | null>(initial.hair_colour ?? null)
  const [eyeColour,  setEyeColour]  = useState<string | null>(initial.eye_colour  ?? null)
  const [build,      setBuild]      = useState<string | null>(initial.build        ?? null)
  const [buildFree,  setBuildFree]  = useState<string>('')  // free-text override for build
  // PROVISIONAL vocabulary — see file header and cast.ts for validation flag
  const [ethnicity,  setEthnicity]  = useState<string | null>(initial.ethnicity   ?? null)
  const [ethnicityFree, setEthnicityFree] = useState<string>('')

  // Level 3 fields
  const [height,     setHeight]     = useState<string>(initial.height            ?? '')
  const [additional, setAdditional] = useState<string>(initial.additional_detail ?? '')
  const [showLevel3, setShowLevel3] = useState(
    !!(initial.height || initial.additional_detail)
  )

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState(false)

  async function handleSave() {
    if (!authToken) return
    setSaving(true)
    setError(false)

    const effectiveBuild    = buildFree.trim() || build
    const effectiveEthnicity = ethnicityFree.trim() || ethnicity

    const fields: Partial<SelfDescriptionFields> = {
      hair_colour:       hairColour            || undefined,
      eye_colour:        eyeColour             || undefined,
      build:             effectiveBuild        || undefined,
      ethnicity:         effectiveEthnicity    || undefined,
      height:            height.trim()         || undefined,
      additional_detail: additional.slice(0, 300).trim() || undefined,
    }

    try {
      const res = await fetch('/api/cast', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ is_self: true, ...fields }),
      })
      if (!res.ok) throw new Error('save_failed')
      setSaved(true)
      onSaved?.(fields)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  // ── Level 0: toggle ──────────────────────────────────────────────────────────

  if (level === 0) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h2 className="text-gray-900/70 text-xs tracking-widest uppercase">A little about you</h2>
          <p className="text-gray-900/55 text-sm leading-relaxed">
            Want your Yearns to reflect a bit of you, physically — if you'd like?
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setLevel(2)}
            className="px-5 py-2.5 text-sm border border-gray-900/20 text-gray-900 hover:border-gray-900/40 transition-colors"
          >
            Yes, why not
          </button>
          <button
            onClick={() => { setSaved(false); onDismissed?.() }}
            className="px-5 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Not right now
          </button>
        </div>
      </div>
    )
  }

  // ── Level 2: light traits ────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-gray-900/70 text-xs tracking-widest uppercase">A little about you</h2>
        <p className="text-gray-900/40 text-sm">
          Each of these is entirely optional, if you'd like.
        </p>
      </div>

      <div className="space-y-6">
        {/* Hair */}
        <div className="space-y-2">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">Hair</p>
          <ChipSelector options={HAIR_OPTIONS} value={hairColour} onChange={setHairColour} />
          {hairColour === null && (
            <input
              type="text"
              placeholder="or describe it your way"
              value=""
              onChange={e => setHairColour(e.target.value || null)}
              className="mt-1 w-full text-sm border-b border-gray-900/15 bg-transparent py-1 text-gray-700 placeholder-gray-400/60 outline-none focus:border-gray-900/30"
            />
          )}
        </div>

        {/* Eyes */}
        <div className="space-y-2">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">Eyes</p>
          <ChipSelector options={EYE_OPTIONS} value={eyeColour} onChange={setEyeColour} />
        </div>

        {/* Build — provisional vocabulary, see file header */}
        <div className="space-y-2">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">Build</p>
          <ChipSelector options={BUILD_OPTIONS} value={build} onChange={v => { setBuild(v); if (v) setBuildFree('') }} />
          {build === null && (
            <input
              type="text"
              placeholder="or describe it your way"
              value={buildFree}
              onChange={e => setBuildFree(e.target.value)}
              className="mt-1 w-full text-sm border-b border-gray-900/15 bg-transparent py-1 text-gray-700 placeholder-gray-400/60 outline-none focus:border-gray-900/30"
            />
          )}
        </div>

        {/* Ethnicity — PROVISIONAL vocabulary, flagged for trainer validation */}
        <div className="space-y-2">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">Ethnicity</p>
          <ChipSelector options={ETHNICITY_OPTIONS} value={ethnicity} onChange={v => { setEthnicity(v); if (v) setEthnicityFree('') }} />
          {ethnicity === null && (
            <input
              type="text"
              placeholder="or describe it your way"
              value={ethnicityFree}
              onChange={e => setEthnicityFree(e.target.value)}
              className="mt-1 w-full text-sm border-b border-gray-900/15 bg-transparent py-1 text-gray-700 placeholder-gray-400/60 outline-none focus:border-gray-900/30"
            />
          )}
        </div>
      </div>

      {/* Level 3 — expand on tap, never shown expanded by default */}
      <div>
        {!showLevel3 ? (
          <button
            onClick={() => setShowLevel3(true)}
            className="text-gray-900/35 text-xs hover:text-gray-900/55 transition-colors"
          >
            Want to add a little more?
          </button>
        ) : (
          <div className="space-y-5 border-t border-gray-900/8 pt-5">
            <div className="space-y-2">
              <p className="text-gray-900/50 text-xs tracking-widest uppercase">Height, if you'd like</p>
              <input
                type="text"
                placeholder="e.g. tall, 5ft 6, petite — whatever feels right"
                value={height}
                onChange={e => setHeight(e.target.value)}
                className="w-full text-sm border-b border-gray-900/15 bg-transparent py-1 text-gray-700 placeholder-gray-400/60 outline-none focus:border-gray-900/30"
              />
            </div>
            <div className="space-y-2">
              <p className="text-gray-900/50 text-xs tracking-widest uppercase">Anything else you'd like your Yearns to know</p>
              <textarea
                rows={3}
                maxLength={300}
                placeholder="Whatever feels relevant — or nothing at all"
                value={additional}
                onChange={e => setAdditional(e.target.value)}
                className="w-full text-sm border border-gray-900/12 bg-transparent p-3 text-gray-700 placeholder-gray-400/60 outline-none focus:border-gray-900/25 resize-none"
              />
              <p className="text-gray-400/60 text-xs text-right">{additional.length}/300</p>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 text-sm border border-gray-900/20 text-gray-900 hover:border-gray-900/40 transition-colors disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved  && <p className="text-gray-500 text-sm">Saved.</p>}
        {error  && <p className="text-gray-500 text-sm">Something went wrong. Try again.</p>}
      </div>
    </div>
  )
}
