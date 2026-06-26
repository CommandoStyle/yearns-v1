'use client'

// YearnShaper — single merged screen for all pre-generation choices.
// Replaces the former two-step flow (YearnControls pre-screen + PreGenerationPanel sheet).
// Field order follows prompt-12 spec.

import { useState, useEffect } from 'react'
import { ExplicitnessDial } from './ExplicitnessDial'
import type { ExplicitnessLevel, SettingType, ParticipantMode, PerceptualChannel, AloneContext, CharacterConfig } from '@/lib/prompt-engine'
import type { GenerateParams } from '@/hooks/useYearn'
import type { CastCharacterRow } from '@/types/cast'
import { getTraitsForGender } from '@/lib/character-traits'
import type { CharacterGender } from '@/lib/character-traits'

// ─── Curated content ──────────────────────────────────────────────────────────

const LENGTHS: { mins: number | 'surprise'; label: string }[] = [
  { mins: 5,          label: '5 min'       },
  { mins: 10,         label: '10 min'      },
  { mins: 15,         label: '15 min'      },
  { mins: 20,         label: '20 min'      },
  { mins: 30,         label: '30 min'      },
  { mins: 'surprise', label: 'Surprise me' },
]

const SETTINGS: { key: SettingType; label: string }[] = [
  { key: 'bedroom',    label: 'Bedroom'    },
  { key: 'hotel',      label: 'Hotel'      },
  { key: 'travelling', label: 'Travelling' },
  { key: 'outdoors',   label: 'Outdoors'   },
  { key: 'urban',      label: 'Urban'      },
  { key: 'workplace',  label: 'Workplace'  },
]

const SPARKS: string[] = [
  "a text that shouldn't have been sent",
  'running into him again, somewhere unexpected',
  'the morning after',
  'working late — just the two of them',
  'coming home to find him waiting',
  'a secret finally said out loud',
  'a look that said everything',
  'a dance that lasted too long',
  'a letter that arrived at the wrong moment',
  'two strangers, one storm',
  'a debt repaid in an unexpected way',
  'the night before everything changed',
  'a door left open',
  'a touch that lasted a beat too long',
  'the moment the rules stopped mattering',
  'a chance meeting that felt like fate',
]

const PACE_OPTIONS: { value: 1 | 2 | 3; label: string; sub: string }[] = [
  { value: 1, label: 'Lingering',   sub: 'slow burn, let it ache'  },
  { value: 2, label: 'Building',    sub: 'tension, then release'   },
  { value: 3, label: 'Inevitable',  sub: 'compressed, urgent'      },
]

const WATCHER_POSITIONS = [
  'through a cracked door',
  'from an adjacent balcony',
  'in the next room, walls are thin',
  'across the restaurant',
  'a video call left on by accident',
  'through the gap in the blinds',
]

const PERCEPTUAL_CHANNELS: { value: PerceptualChannel; label: string }[] = [
  { value: 'full_sight', label: 'I can see everything'                         },
  { value: 'sound_only', label: 'I can only hear'                              },
  { value: 'fragments',  label: 'glimpses and fragments, not the full picture' },
  { value: 'peripheral', label: 'aware of them, not directly watching'         },
]

const RELATIONSHIPS = [
  'a stranger',
  'a friend',
  'a coworker',
  'my partner, with someone else',
  'someone from my past',
]

const INTERIOR_STATES = [
  'an illicit thrill',
  'envy',
  "tenderness I didn't expect",
  'arousal mixed with guilt',
  'detached fascination',
  "I shouldn't be watching and I can't look away",
]

const ROLES_ESTABLISHED   = ['husband', 'boyfriend', 'wife', 'girlfriend', 'long-term partner']
const ROLES_SERVICE       = ['plumber', 'personal trainer', 'masseuse', 'real estate agent', 'delivery driver']
const ROLES_PROXIMITY     = ['neighbor', 'coworker', 'boss', 'stranger']
const ROLES_TRANSGRESSIVE = ["friend's husband", "friend's wife", 'ex', 'best friend']

const ALONE_FOCUS_OPTIONS: { value: AloneContext['focus']; label: string; sub: string }[] = [
  { value: 'solitude',            label: 'Just herself',        sub: 'pure internal, sensory'       },
  { value: 'object',              label: 'With a toy',          sub: 'an object, part of the scene' },
  { value: 'watching_or_reading', label: 'Watching something',  sub: 'consuming adult content'      },
  { value: 'memory',              label: 'A memory',            sub: 'blending past and present'    },
]

const SURPRISE_LENGTHS = [10, 15, 20]

function surpriseMins(): number {
  return SURPRISE_LENGTHS[Math.floor(Math.random() * SURPRISE_LENGTHS.length)]
}

function emptyCharacter(): CharacterConfig {
  return { id: Math.random().toString(36).slice(2), gender: 'unspecified' }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface YearnShaperProps {
  onGenerate:       (params: GenerateParams) => void
  defaultMode?:     ParticipantMode
  defaultLevel?:    ExplicitnessLevel
  defaultLength?:   number
  authToken:        string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

const OUTFIT_PLACEHOLDERS = [
  'running shoes and leggings',
  'an old band t-shirt',
  'the robe you wear on Sunday mornings',
  'nothing',
  'jeans and a jumper',
  'whatever you threw on this morning',
]

function pickOutfitPlaceholder(): string {
  return OUTFIT_PLACEHOLDERS[Math.floor(Math.random() * OUTFIT_PLACEHOLDERS.length)]
}

export function YearnShaper({
  onGenerate,
  defaultMode   = 'participant',
  defaultLevel  = 2,
  defaultLength,
  authToken,
}: YearnShaperProps) {

  // 1. Mode
  const [mode, setMode] = useState<ParticipantMode>(defaultMode)

  // 2. Duration
  const [lengthSelection, setLengthSelection] = useState<number | 'surprise'>(defaultLength ?? 10)

  // 3. Current yearning
  const [currentYearning, setCurrentYearning] = useState('')

  // 4. Mode-dependent: participant
  const [characters, setCharacters] = useState<CharacterConfig[]>([emptyCharacter()])
  const [showCharacters, setShowCharacters] = useState(false)
  const [showTransgressiveRoles, setShowTransgressiveRoles] = useState<Record<string, boolean>>({})
  const [characterSource, setCharacterSource] = useState<Record<string, 'cast' | 'new'>>({})
  const [savedCast, setSavedCast] = useState<CastCharacterRow[]>([])

  // 4. Mode-dependent: voyeur
  const [watcherPosition, setWatcherPosition]     = useState('')
  const [watcherPositionFree, setWatcherPositionFree] = useState('')
  const [perceptualChannel, setPerceptualChannel] = useState<PerceptualChannel>('full_sight')
  const [relationship, setRelationship]           = useState('')
  const [relationshipFree, setRelationshipFree]   = useState('')
  const [interiorState, setInteriorState]         = useState<string[]>([])

  // 4. Mode-dependent: alone
  const [aloneFocus, setAloneFocus]   = useState<AloneContext['focus']>('solitude')
  const [discoveryRisk, setDiscoveryRisk] = useState(false)

  // 5. Where
  const [setting, setSetting]             = useState<SettingType>('bedroom')
  const [specificDetail, setSpecificDetail] = useState('')

  // 6. Spark
  const [spark, setSpark]               = useState<string | null>(null)
  const [sparkFreeText, setSparkFreeText] = useState('')
  const [showSparks, setShowSparks]     = useState(false)
  const [showAllSparks, setShowAllSparks] = useState(false)

  // 7. Pace
  const [pace, setPace] = useState<1 | 2 | 3>(2)

  // 8. Explicitness (defaults to last-used level via prop)
  const [explicitness, setExplicitness] = useState<ExplicitnessLevel>(defaultLevel)

  // 9. Outfit
  const [outfit, setOutfit]               = useState('')
  const [wardrobeItems, setWardrobeItems] = useState<{id: string; description: string}[]>([])
  const [outfitPlaceholder]               = useState(() => pickOutfitPlaceholder())

  // Fetch saved cast (non-self) once auth is available
  useEffect(() => {
    if (!authToken) return
    fetch('/api/cast', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : { cast: [] })
      .then(({ cast }) => setSavedCast((cast as CastCharacterRow[]).filter(c => !c.is_self)))
      .catch(() => {})
    fetch('/api/wardrobe', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : { items: [] })
      .then(({ items }) => setWardrobeItems(items ?? []))
      .catch(() => {})
  }, [authToken])

  // Character helpers
  function updateCharacter(id: string, patch: Partial<CharacterConfig>) {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function pickFromCast(charId: string, cm: CastCharacterRow) {
    setCharacters(prev => prev.map(c => c.id !== charId ? c : {
      ...c,
      name:   cm.name   ?? c.name,
      gender: (cm.gender as CharacterConfig['gender']) ?? c.gender,
      traits: cm.traits ?? c.traits,
      role:   cm.role   ?? c.role,
    }))
    setCharacterSource(prev => ({ ...prev, [charId]: 'cast' }))
  }

  function toggleTrait(charId: string, trait: string) {
    setCharacters(prev => prev.map(c => {
      if (c.id !== charId) return c
      const has = c.traits?.includes(trait)
      if (has) return { ...c, traits: c.traits!.filter(t => t !== trait) }
      if ((c.traits?.length ?? 0) >= 2) return c
      return { ...c, traits: [...(c.traits ?? []), trait] }
    }))
  }

  function toggleInteriorState(s: string) {
    setInteriorState(prev =>
      prev.includes(s) ? prev.filter(x => x !== s)
        : prev.length < 2 ? [...prev, s] : prev
    )
  }

  function signal(event: string, data: Record<string, unknown>) {
    if (!authToken) return
    fetch('/api/profile/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ event, data, timestamp: Date.now() }),
      keepalive: true,
    }).catch(() => {})
  }

  function handleGenerate() {
    const resolvedMins = lengthSelection === 'surprise' ? surpriseMins() : lengthSelection
    const activeSpark  = sparkFreeText.trim() || spark || undefined
    const activePos    = watcherPositionFree.trim() || watcherPosition || undefined
    const activeRel    = relationshipFree.trim() || relationship || undefined
    const activeChars  = characters.filter(c => c.name || c.gender !== 'unspecified' || c.traits?.length || c.role)

    if (activeSpark)             signal('spark_selected',           { spark: activeSpark })
    if (activeChars.length)      signal('characters_configured',    { count: activeChars.length })
    if (pace !== 2)              signal('pace_selected',            { pace })
    if (specificDetail.trim())   signal('specific_detail_used',     {})
    if (currentYearning.trim())  signal('current_yearning_used',    {})
    if (mode !== defaultMode)    signal('participant_mode_overridden', { mode })
    if (mode === 'voyeur' && activePos) signal('voyeur_context_used', { channel: perceptualChannel })
    if (mode === 'alone')        signal('alone_mode_used',          { focus: aloneFocus, discovery_risk: discoveryRisk })
    if (explicitness !== defaultLevel) signal('explicitness_changed', { level: explicitness })

    const voyeurContext = mode === 'voyeur' ? {
      watcher_position:        activePos ?? 'nearby, unnoticed',
      perceptual_channel:      perceptualChannel,
      relationship_to_watched: activeRel ?? "someone you don't know well",
      interior_state:          interiorState.length ? interiorState : ['an illicit thrill'],
    } : undefined

    const aloneContext: AloneContext | undefined = mode === 'alone'
      ? { focus: aloneFocus, discovery_risk: discoveryRisk }
      : undefined

    onGenerate({
      explicitness,
      setting,
      length_mins:               resolvedMins,
      spark:                     activeSpark,
      characters:                mode !== 'alone' && activeChars.length ? activeChars : undefined,
      pace,
      specific_detail:           specificDetail.trim() || undefined,
      current_yearning:          currentYearning.trim() || undefined,
      participant_mode_override: mode !== defaultMode ? mode : undefined,
      voyeur_context:            voyeurContext,
      alone_context:             aloneContext,
      outfit:                    outfit.trim() || undefined,
    })
  }

  const visibleSparks = showAllSparks ? SPARKS : SPARKS.slice(0, 6)
  const rosterLabel   = mode === 'participant' ? "Who's with you" : "Who you're watching"

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-16">
      <a
        href="/settings"
        className="fixed top-4 right-5 text-gray-900/20 text-xs tracking-widest uppercase hover:text-gray-900/50 transition-colors duration-200"
      >
        Settings
      </a>

      <div className="w-full max-w-md space-y-10 animate-fade-up">

        {/* Brand */}
        <div className="text-center space-y-1">
          <h1 className="font-serif text-4xl text-gray-900 tracking-tight">Yearns</h1>
          <p className="text-gray-600/70 text-xs tracking-widest uppercase font-light">Your story awaits</p>
        </div>

        {/* 1 — Mode */}
        <div className="space-y-3">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">You are</p>
          <div className="flex border border-gray-900/12 rounded-sm overflow-hidden">
            {([
              { value: 'participant', label: 'In this story'      },
              { value: 'voyeur',      label: 'Watching it unfold' },
              { value: 'alone',       label: 'Alone'              },
            ] as { value: ParticipantMode; label: string }[]).map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`flex-1 py-2.5 text-xs transition-colors duration-200 ${
                  mode === m.value
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2 — Duration */}
        <div className="space-y-3">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">How long?</p>
          <div className="flex flex-wrap gap-2">
            {LENGTHS.map(({ mins, label }) => (
              <button
                key={String(mins)}
                onClick={() => setLengthSelection(mins)}
                className={`px-3 py-2.5 text-xs transition-all duration-200 ${
                  lengthSelection === mins
                    ? 'border border-gray-600/70 text-gray-600'
                    : 'border border-gray-900/12 text-gray-900/40 hover:border-gray-900/25 hover:text-gray-900/65'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 3 — Current yearning */}
        <div className="space-y-2">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">What&apos;s your yearning?</p>
          <textarea
            maxLength={120}
            value={currentYearning}
            onChange={e => setCurrentYearning(e.target.value)}
            placeholder="to feel completely wanted, to lose track of time, to be surprised…"
            rows={2}
            className="w-full bg-transparent border-b border-gray-900/12 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 resize-none transition-colors duration-200 leading-relaxed"
          />
          <p className="text-right text-gray-300 text-xs">{currentYearning.length}/120</p>
        </div>

        {/* 4 — Mode-dependent block */}

        {/* Voyeur context */}
        {mode === 'voyeur' && (
          <div className="space-y-5 border-l-2 border-gray-100 pl-4">
            <div className="space-y-2">
              <p className="text-gray-500 text-xs tracking-widest uppercase">Where are you?</p>
              <div className="flex flex-wrap gap-2">
                {WATCHER_POSITIONS.map(pos => (
                  <button key={pos}
                    onClick={() => { setWatcherPosition(p => p === pos ? '' : pos); setWatcherPositionFree('') }}
                    className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                      watcherPosition === pos ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >{pos}</button>
                ))}
              </div>
              <input type="text" value={watcherPositionFree}
                onChange={e => { setWatcherPositionFree(e.target.value); setWatcherPosition('') }}
                placeholder="or describe your position…"
                className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
              />
            </div>
            <div className="space-y-2">
              <p className="text-gray-500 text-xs tracking-widest uppercase">What can you perceive?</p>
              <div className="space-y-1.5">
                {PERCEPTUAL_CHANNELS.map(ch => (
                  <button key={ch.value} onClick={() => setPerceptualChannel(ch.value)}
                    className={`w-full text-left px-3 py-2 text-xs border rounded-sm transition-colors duration-200 ${
                      perceptualChannel === ch.value ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >{ch.label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-gray-500 text-xs tracking-widest uppercase">Who are they to you?</p>
              <div className="flex flex-wrap gap-2">
                {RELATIONSHIPS.map(r => (
                  <button key={r}
                    onClick={() => { setRelationship(p => p === r ? '' : r); setRelationshipFree('') }}
                    className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                      relationship === r ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >{r}</button>
                ))}
              </div>
              <input type="text" value={relationshipFree}
                onChange={e => { setRelationshipFree(e.target.value); setRelationship('') }}
                placeholder="or describe the relationship…"
                className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
              />
            </div>
            <div className="space-y-2">
              <p className="text-gray-500 text-xs tracking-widest uppercase">How does watching make you feel?</p>
              <div className="flex flex-wrap gap-2">
                {INTERIOR_STATES.map(s => (
                  <button key={s} onClick={() => toggleInteriorState(s)}
                    disabled={!interiorState.includes(s) && interiorState.length >= 2}
                    className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 disabled:opacity-30 ${
                      interiorState.includes(s) ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >{s}</button>
                ))}
              </div>
              {interiorState.length === 2 && <p className="text-gray-300 text-xs">max 2 selected</p>}
            </div>
          </div>
        )}

        {/* Alone context */}
        {mode === 'alone' && (
          <div className="space-y-5 border-l-2 border-gray-100 pl-4">
            <div className="space-y-2">
              <p className="text-gray-500 text-xs tracking-widest uppercase">What&apos;s the scene?</p>
              <div className="grid grid-cols-2 gap-2">
                {ALONE_FOCUS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setAloneFocus(opt.value)}
                    className={`py-3 border rounded-sm text-center transition-colors duration-200 ${
                      aloneFocus === opt.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <p className={`text-xs font-medium ${aloneFocus === opt.value ? 'text-gray-900' : 'text-gray-500'}`}>{opt.label}</p>
                    <p className="text-gray-400 text-[10px] mt-0.5">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs tracking-widest uppercase">Risk of discovery</p>
                <p className="text-gray-400 text-[10px] mt-0.5">
                  {discoveryRisk ? 'someone could walk in — adds tension' : 'completely private'}
                </p>
              </div>
              <button
                onClick={() => setDiscoveryRisk(r => !r)}
                className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${discoveryRisk ? 'bg-gray-900' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${discoveryRisk ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {/* Participant / voyeur character roster */}
        {mode !== 'alone' && (
          <div className="space-y-2">
            <button
              onClick={() => setShowCharacters(s => !s)}
              className="flex items-center justify-between w-full text-left"
            >
              <p className="text-gray-900/50 text-xs tracking-widest uppercase">{rosterLabel}</p>
              <span className="text-gray-300 text-xs">{showCharacters ? '−' : '+'}</span>
            </button>

            {showCharacters && (
              <div className="space-y-5">
                {characters.map((char, idx) => (
                  <div key={char.id} className="space-y-3 border-l-2 border-gray-100 pl-3">
                    <div className="flex items-center justify-between">
                      <p className="text-gray-400 text-xs">Character {idx + 1}</p>
                      {characters.length > 1 && (
                        <button
                          onClick={() => setCharacters(prev => prev.filter(c => c.id !== char.id))}
                          className="text-gray-300 text-xs hover:text-gray-500 transition-colors"
                        >remove</button>
                      )}
                    </div>

                    {/* Cast source fork — only shown if user has saved cast */}
                    {savedCast.length > 0 && characterSource[char.id] === undefined && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => setCharacterSource(prev => ({ ...prev, [char.id]: 'cast' }))}
                          className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 hover:border-gray-400 transition-colors"
                        >from your cast</button>
                        <button
                          onClick={() => setCharacterSource(prev => ({ ...prev, [char.id]: 'new' }))}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >someone new</button>
                      </div>
                    )}

                    {/* Cast member picker */}
                    {characterSource[char.id] === 'cast' && (
                      <div className="space-y-1.5">
                        {savedCast.map(cm => (
                          <button key={cm.id} onClick={() => pickFromCast(char.id, cm)}
                            className="w-full text-left px-3 py-2 border border-gray-200 hover:border-gray-400 transition-colors text-xs text-gray-700"
                          >
                            <span className="font-medium">{cm.name || 'unnamed'}</span>
                            {cm.gender && cm.gender !== 'unspecified' && <span className="text-gray-400 ml-1">({cm.gender})</span>}
                            {cm.role && <span className="text-gray-400 ml-1">· {cm.role}</span>}
                          </button>
                        ))}
                        <button
                          onClick={() => setCharacterSource(prev => ({ ...prev, [char.id]: 'new' }))}
                          className="text-gray-400 text-xs hover:text-gray-600 transition-colors"
                        >someone new instead</button>
                      </div>
                    )}

                    {/* Editable fields */}
                    {(characterSource[char.id] === 'new' || characterSource[char.id] === 'cast' || savedCast.length === 0) && (
                      <div className="space-y-3">
                        <input type="text" value={char.name ?? ''}
                          onChange={e => updateCharacter(char.id, { name: e.target.value || undefined })}
                          placeholder="name (optional)…"
                          className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
                        />
                        <div className="flex gap-2">
                          {(['man', 'woman', 'unspecified'] as const).map(g => (
                            <button key={g}
                              onClick={() => updateCharacter(char.id, { gender: g as CharacterGender, traits: [] })}
                              className={`flex-1 py-2 text-xs border rounded-sm transition-colors duration-200 ${
                                (char.gender ?? 'unspecified') === g
                                  ? 'border-gray-900 text-gray-900 bg-gray-50'
                                  : 'border-gray-200 text-gray-400 hover:border-gray-400'
                              }`}
                            >{g === 'unspecified' ? 'story decides' : g}</button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {getTraitsForGender((char.gender ?? 'unspecified') as CharacterGender).map(t => (
                            <button key={t} onClick={() => toggleTrait(char.id, t)}
                              disabled={!char.traits?.includes(t) && (char.traits?.length ?? 0) >= 2}
                              className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 disabled:opacity-30 ${
                                char.traits?.includes(t)
                                  ? 'border-gray-900 text-gray-900 bg-gray-50'
                                  : 'border-gray-200 text-gray-500 hover:border-gray-400'
                              }`}
                            >{t}</button>
                          ))}
                        </div>
                        {(char.traits?.length ?? 0) === 2 && <p className="text-gray-300 text-xs">max 2 traits</p>}
                        <div className="space-y-2 pt-1">
                          <p className="text-gray-400 text-[10px] tracking-widest uppercase">Role (optional)</p>
                          {char.role && (
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1.5 text-xs border border-gray-900 text-gray-900 bg-gray-50 rounded-sm">{char.role}</span>
                              <button onClick={() => updateCharacter(char.id, { role: undefined })} className="text-gray-300 text-xs hover:text-gray-500">clear</button>
                            </div>
                          )}
                          <div className="space-y-2">
                            {[
                              { label: 'Established', roles: ROLES_ESTABLISHED },
                              { label: 'Service',     roles: ROLES_SERVICE     },
                              { label: 'Proximity',   roles: ROLES_PROXIMITY   },
                            ].map(group => (
                              <div key={group.label} className="space-y-1">
                                <p className="text-gray-300 text-[10px]">{group.label}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {group.roles.map(r => (
                                    <button key={r}
                                      onClick={() => updateCharacter(char.id, { role: char.role === r ? undefined : r })}
                                      className={`px-2.5 py-1 text-xs border rounded-sm transition-colors duration-200 ${
                                        char.role === r ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                                      }`}
                                    >{r}</button>
                                  ))}
                                </div>
                              </div>
                            ))}
                            <button
                              onClick={() => setShowTransgressiveRoles(prev => ({ ...prev, [char.id]: !prev[char.id] }))}
                              className="text-gray-400 text-xs hover:text-gray-600 transition-colors pt-0.5"
                            >{showTransgressiveRoles[char.id] ? '− fewer roles' : '+ explore more roles'}</button>
                            {showTransgressiveRoles[char.id] && (
                              <div className="space-y-1">
                                <p className="text-gray-300 text-[10px]">Transgressive proximity</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {ROLES_TRANSGRESSIVE.map(r => (
                                    <button key={r}
                                      onClick={() => updateCharacter(char.id, { role: char.role === r ? undefined : r })}
                                      className={`px-2.5 py-1 text-xs border rounded-sm transition-colors duration-200 ${
                                        char.role === r ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                                      }`}
                                    >{r}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <input type="text"
                              value={!ROLES_ESTABLISHED.concat(ROLES_SERVICE, ROLES_PROXIMITY, ROLES_TRANSGRESSIVE).includes(char.role ?? '') ? (char.role ?? '') : ''}
                              onChange={e => updateCharacter(char.id, { role: e.target.value || undefined })}
                              placeholder="or type a role…"
                              className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-xs text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {characters.length < 4 && (
                  <button
                    onClick={() => setCharacters(prev => [...prev, emptyCharacter()])}
                    className="text-gray-400 text-xs border border-dashed border-gray-200 px-3 py-1.5 rounded-sm hover:border-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >+ add another character</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5 — Where does it unfold? */}
        <div className="space-y-3">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">Where does it unfold?</p>
          <div className="grid grid-cols-3 gap-2">
            {SETTINGS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSetting(key)}
                className={`py-2.5 text-xs transition-all duration-200 ${
                  setting === key
                    ? 'border border-gray-600/70 text-gray-600'
                    : 'border border-gray-900/12 text-gray-900/40 hover:border-gray-900/25 hover:text-gray-900/65'
                }`}
              >{label}</button>
            ))}
          </div>
          <input
            type="text"
            maxLength={60}
            value={specificDetail}
            onChange={e => setSpecificDetail(e.target.value)}
            placeholder="anywhere specific? (the hotel from last year, his apartment…)"
            className="w-full bg-transparent border-b border-gray-900/12 focus:border-gray-500 outline-none text-xs text-gray-700 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
          />
        </div>

        {/* 5b — Outfit */}
        <div className="space-y-2">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">What are you wearing?</p>
          {wardrobeItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {wardrobeItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setOutfit(item.description)}
                  className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                    outfit === item.description
                      ? 'border-gray-900 text-gray-900 bg-gray-50'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {item.description}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            maxLength={80}
            value={outfit}
            onChange={e => setOutfit(e.target.value)}
            placeholder={outfitPlaceholder}
            className="w-full bg-transparent border-b border-gray-900/12 focus:border-gray-500 outline-none text-xs text-gray-700 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
          />
        </div>

        {/* 6 — Spark */}
        <div className="space-y-2">
          <button
            onClick={() => setShowSparks(s => !s)}
            className="flex items-center justify-between w-full text-left"
          >
            <p className="text-gray-900/50 text-xs tracking-widest uppercase">Spark</p>
            <span className="text-gray-300 text-xs">{showSparks ? '−' : '+'}</span>
          </button>
          {showSparks && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {visibleSparks.map(s => (
                  <button key={s}
                    onClick={() => { setSpark(prev => prev === s ? null : s); setSparkFreeText('') }}
                    className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                      spark === s ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >{s}</button>
                ))}
                <button
                  onClick={() => { setSpark('surprise_me'); setSparkFreeText('') }}
                  className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                    spark === 'surprise_me' ? 'border-gray-900 text-gray-900 bg-gray-50' : 'border-gray-200 text-gray-400 hover:border-gray-400'
                  }`}
                >surprise me</button>
                {!showAllSparks && SPARKS.length > 6 && (
                  <button
                    onClick={() => setShowAllSparks(true)}
                    className="px-3 py-1.5 text-xs border border-dashed border-gray-200 text-gray-400 rounded-sm hover:border-gray-400"
                  >more…</button>
                )}
              </div>
              <input type="text" value={sparkFreeText}
                onChange={e => { setSparkFreeText(e.target.value); setSpark(null) }}
                placeholder="or write your own…"
                className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
              />
            </div>
          )}
        </div>

        {/* 7 — Pace */}
        <div className="space-y-3">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">Pace</p>
          <div className="flex gap-2">
            {PACE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPace(opt.value)}
                className={`flex-1 py-3 border rounded-sm text-center transition-colors duration-200 ${
                  pace === opt.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <p className={`text-xs font-medium ${pace === opt.value ? 'text-gray-900' : 'text-gray-500'}`}>{opt.label}</p>
                <p className="text-gray-400 text-[10px] mt-0.5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 8 — Explicitness */}
        <div className="space-y-3">
          <p className="text-gray-900/50 text-xs tracking-widest uppercase">How explicit?</p>
          <ExplicitnessDial value={explicitness} onChange={setExplicitness} />
        </div>

        {/* 9 — CTA */}
        <button
          onClick={handleGenerate}
          className="w-full py-5 border border-gray-600/50 text-gray-600 font-serif text-lg tracking-wide hover:bg-gray-600/8 transition-all duration-300"
        >
          Write my Yearn
        </button>

        <p className="text-center text-gray-900/25 text-xs tracking-wide">All optional — skip anything</p>

      </div>
    </div>
  )
}
