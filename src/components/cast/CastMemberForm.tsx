'use client'

// Shared add/edit form for non-self cast members.
// Used by /profile/cast page. Fields mirror the ephemeral CharacterConfig
// from the per-story roster, plus optional physical description.

import { useState } from 'react'
import type { CastCharacterRow } from '@/types/cast'

const TRAITS = [
  'the way he listens before he speaks',
  'unbothered, unreadable',
  'good with his hands and knows it',
  'says less than he means',
  'quietly certain of himself',
  'takes his time',
  'notices things other people miss',
  'knows exactly what he wants',
  'comfortable with silence',
  'gentle until he isn\'t',
]

const ROLES_ESTABLISHED   = ['husband', 'boyfriend', 'wife', 'girlfriend', 'long-term partner']
const ROLES_SERVICE       = ['plumber', 'personal trainer', 'masseuse', 'real estate agent', 'delivery driver']
const ROLES_PROXIMITY     = ['neighbor', 'coworker', 'boss', 'stranger']
const ROLES_TRANSGRESSIVE = ["friend's husband", "friend's wife", 'ex', 'best friend']

interface CastMemberFormProps {
  initial?: Partial<CastCharacterRow>
  onSave:   (data: Partial<CastCharacterRow>) => void
  onCancel: () => void
}

export function CastMemberForm({ initial, onSave, onCancel }: CastMemberFormProps) {
  const [name,    setName]    = useState(initial?.name   ?? '')
  const [gender,  setGender]  = useState<'man' | 'woman' | 'unspecified'>(
    (initial?.gender as 'man' | 'woman' | 'unspecified') ?? 'unspecified'
  )
  const [traits,  setTraits]  = useState<string[]>(initial?.traits ?? [])
  const [role,    setRole]    = useState(initial?.role   ?? '')
  const [roleFree, setRoleFree] = useState('')
  const [showMore, setShowMore] = useState(false)

  function toggleTrait(t: string) {
    setTraits(prev => {
      if (prev.includes(t)) return prev.filter(x => x !== t)
      if (prev.length >= 2) return prev
      return [...prev, t]
    })
  }

  function handleSave() {
    onSave({
      name:   name.trim() || null,
      gender,
      role:   roleFree.trim() || role || null,
      traits: traits.length > 0 ? traits : null,
    })
  }

  return (
    <div className="space-y-6">
      {/* Name */}
      <div className="space-y-1">
        <p className="text-gray-900/50 text-xs tracking-widest uppercase">Name (optional)</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="leave blank and the story will choose"
          className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors"
        />
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <p className="text-gray-900/50 text-xs tracking-widest uppercase">Gender</p>
        <div className="flex gap-2">
          {(['man', 'woman', 'unspecified'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGender(g)}
              className={`flex-1 py-2 text-xs border rounded-sm transition-colors ${
                gender === g
                  ? 'border-gray-900 text-gray-900 bg-gray-50'
                  : 'border-gray-200 text-gray-400 hover:border-gray-400'
              }`}
            >
              {g === 'unspecified' ? 'story decides' : g}
            </button>
          ))}
        </div>
      </div>

      {/* Traits */}
      <div className="space-y-2">
        <p className="text-gray-900/50 text-xs tracking-widest uppercase">Traits (up to 2)</p>
        <div className="flex flex-wrap gap-2">
          {TRAITS.map(t => (
            <button
              key={t}
              onClick={() => toggleTrait(t)}
              disabled={!traits.includes(t) && traits.length >= 2}
              className={`px-3 py-1.5 text-xs border rounded-sm transition-colors disabled:opacity-30 ${
                traits.includes(t)
                  ? 'border-gray-900 text-gray-900 bg-gray-50'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {traits.length === 2 && <p className="text-gray-300 text-xs">max 2 traits selected</p>}
      </div>

      {/* Role */}
      <div className="space-y-2">
        <p className="text-gray-900/50 text-xs tracking-widest uppercase">Role (optional)</p>
        {role && (
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1.5 text-xs border border-gray-900 text-gray-900 bg-gray-50 rounded-sm">{role}</span>
            <button onClick={() => setRole('')} className="text-gray-300 text-xs hover:text-gray-500">×</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {[...ROLES_ESTABLISHED, ...ROLES_SERVICE, ...ROLES_PROXIMITY].map(r => (
            <button key={r} onClick={() => { setRole(r); setRoleFree('') }}
              className={`px-3 py-1.5 text-xs border rounded-sm transition-colors ${
                role === r ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}>
              {r}
            </button>
          ))}
        </div>
        <button onClick={() => setShowMore(s => !s)} className="text-gray-400 text-[10px] hover:text-gray-600 transition-colors">
          {showMore ? 'fewer roles' : 'more roles'}
        </button>
        {showMore && (
          <div className="flex flex-wrap gap-2">
            {ROLES_TRANSGRESSIVE.map(r => (
              <button key={r} onClick={() => { setRole(r); setRoleFree('') }}
                className={`px-3 py-1.5 text-xs border rounded-sm transition-colors ${
                  role === r ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                }`}>
                {r}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder="or free-text…"
          value={roleFree}
          onChange={e => { setRoleFree(e.target.value); if (e.target.value) setRole('') }}
          className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-xs text-gray-700 placeholder:text-gray-300 py-1.5 transition-colors mt-1"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-2">
        <button
          onClick={handleSave}
          className="px-5 py-2.5 text-sm border border-gray-900/20 text-gray-900 hover:border-gray-900/40 transition-colors"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
