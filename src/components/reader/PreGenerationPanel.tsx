'use client'

import { useState, useEffect } from 'react'
import type { GenerateParams } from '@/hooks/useYearn'
import type { AloneContext, CharacterConfig, ParticipantMode, PerceptualChannel } from '@/lib/prompt-engine'
import type { CastCharacterRow } from '@/types/cast'
import { getTraitsForGender } from '@/lib/character-traits'
import type { CharacterGender } from '@/lib/character-traits'

// ─── Curated content ──────────────────────────────────────────────────────────
// Sparks are present-day / real-world scenarios (ADR-003 — here and now).
// Genre arrays removed; all sparks are now treated as equally weighted.

const SPARKS: string[] = [
  'a text that shouldn\'t have been sent',
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

// Trait list is gender-aware — rendered per-character via getTraitsForGender().

const PACE_OPTIONS: { value: 1 | 2 | 3; label: string; sub: string }[] = [
  { value: 1, label: 'Lingering',   sub: 'slow burn, let it ache' },
  { value: 2, label: 'Building',    sub: 'tension, then release' },
  { value: 3, label: 'Inevitable',  sub: 'compressed, urgent' },
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
  { value: 'full_sight', label: 'I can see everything'                          },
  { value: 'sound_only', label: 'I can only hear'                               },
  { value: 'fragments',  label: 'glimpses and fragments, not the full picture'  },
  { value: 'peripheral', label: 'aware of them, not directly watching'          },
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
  'tenderness I didn\'t expect',
  'arousal mixed with guilt',
  'detached fascination',
  'I shouldn\'t be watching and I can\'t look away',
]

// ─── Curated roles ────────────────────────────────────────────────────────────

const ROLES_ESTABLISHED = ['husband', 'boyfriend', 'wife', 'girlfriend', 'long-term partner']
const ROLES_SERVICE     = ['plumber', 'personal trainer', 'masseuse', 'real estate agent', 'delivery driver']
const ROLES_PROXIMITY   = ['neighbor', 'coworker', 'boss', 'stranger']
const ROLES_TRANSGRESSIVE = ["friend's husband", "friend's wife", 'ex', 'best friend']

const ALONE_FOCUS_OPTIONS: { value: AloneContext['focus']; label: string; sub: string }[] = [
  { value: 'solitude',           label: 'Just herself',        sub: 'pure internal, sensory'         },
  { value: 'object',             label: 'With a toy',          sub: 'an object, part of the scene'   },
  { value: 'watching_or_reading', label: 'Watching something', sub: 'consuming adult content'        },
  { value: 'memory',             label: 'A memory',            sub: 'blending past and present'      },
]

// ─── Empty character factory ──────────────────────────────────────────────────

function emptyCharacter(): CharacterConfig {
  return { id: Math.random().toString(36).slice(2), gender: 'unspecified' }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PreGenerationPanelProps {
  baseParams:    GenerateParams
  defaultMode?:  ParticipantMode
  onConfirm:     (params: GenerateParams) => void
  onSkip:        () => void
  authToken:     string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PreGenerationPanel({
  baseParams,
  defaultMode = 'participant',
  onConfirm,
  onSkip,
  authToken,
}: PreGenerationPanelProps) {
  const [mode, setMode] = useState<ParticipantMode>(defaultMode)

  // ── Shared fields ──────────────────────────────────────────────────────────
  const [spark, setSpark]               = useState<string | null>(null)
  const [sparkFreeText, setSparkFreeText] = useState('')
  const [showAllSparks, setShowAllSparks] = useState(false)
  const [showSparks, setShowSparks]     = useState(false)
  const [pace, setPace]                 = useState<1 | 2 | 3>(2)
  const [specificDetail, setSpecificDetail] = useState('')
  const [tonightsWant, setTonightsWant]     = useState('')

  // ── Participant-mode: character roster ─────────────────────────────────────
  const [characters, setCharacters] = useState<CharacterConfig[]>([emptyCharacter()])
  const [showCharacters, setShowCharacters] = useState(false)
  // Per-character: whether the "explore more roles" expansion is open
  const [showTransgressiveRoles, setShowTransgressiveRoles] = useState<Record<string, boolean>>({})
  // Per-character cast source: 'cast' | 'new'. null = not yet chosen.
  const [characterSource, setCharacterSource]  = useState<Record<string, 'cast' | 'new'>>({})
  // Promoted-from-story: after generation, offer to save ephemeral chars to cast
  const [promoteCandidates, setPromoteCandidates] = useState<CharacterConfig[]>([])

  // ── Saved cast (fetched once on mount when authToken is available) ──────────
  const [savedCast, setSavedCast] = useState<CastCharacterRow[]>([])

  useEffect(() => {
    if (!authToken) return
    fetch('/api/cast', { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : { cast: [] })
      .then(({ cast }) => setSavedCast((cast as CastCharacterRow[]).filter(c => !c.is_self)))
      .catch(() => {})
  }, [authToken])

  // ── Voyeur-mode: watcher context ───────────────────────────────────────────
  const [watcherPosition, setWatcherPosition]   = useState('')
  const [watcherPositionFree, setWatcherPositionFree] = useState('')
  const [perceptualChannel, setPerceptualChannel] = useState<PerceptualChannel>('full_sight')
  const [relationship, setRelationship]         = useState('')
  const [relationshipFree, setRelationshipFree] = useState('')
  const [interiorState, setInteriorState]       = useState<string[]>([])

  // ── Alone-mode: focus + discovery risk ─────────────────────────────────────
  const [aloneFocus, setAloneFocus]             = useState<AloneContext['focus']>('solitude')
  const [discoveryRisk, setDiscoveryRisk]       = useState(false)

  // ── Spark helpers ──────────────────────────────────────────────────────────
  const visibleSparks = showAllSparks ? SPARKS : SPARKS.slice(0, 6)

  // ── Character helpers ──────────────────────────────────────────────────────
  function updateCharacter(id: string, patch: Partial<CharacterConfig>) {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  // Pre-fill a character slot from a saved cast member.
  // Per-story edits to the pre-filled slot do NOT mutate the saved cast record
  // unless the user explicitly saves it back (promote-from-story path).
  function pickFromCast(charId: string, castMember: CastCharacterRow) {
    setCharacters(prev => prev.map(c => c.id !== charId ? c : {
      ...c,
      name:   castMember.name   ?? c.name,
      gender: (castMember.gender as CharacterConfig['gender']) ?? c.gender,
      traits: castMember.traits ?? c.traits,
      role:   castMember.role   ?? c.role,
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

  function addCharacter() {
    if (characters.length >= 4) return
    setCharacters(prev => [...prev, emptyCharacter()])
  }

  function removeCharacter(id: string) {
    setCharacters(prev => prev.length > 1 ? prev.filter(c => c.id !== id) : prev)
  }

  // ── Interior state (voyeur, max 2) ─────────────────────────────────────────
  function toggleInteriorState(s: string) {
    setInteriorState(prev =>
      prev.includes(s) ? prev.filter(x => x !== s)
        : prev.length < 2 ? [...prev, s] : prev
    )
  }

  // ── Confirm ────────────────────────────────────────────────────────────────
  function handleConfirm() {
    const activeSpark = sparkFreeText.trim() || spark || undefined
    const activePosition = watcherPositionFree.trim() || watcherPosition || undefined
    const activeRelationship = relationshipFree.trim() || relationship || undefined

    const activeCharacters = characters.filter(c => c.name || c.gender !== 'unspecified' || c.traits?.length || c.role)

    if (activeSpark)                signal('spark_selected',             { spark: activeSpark })
    if (activeCharacters.length)    signal('characters_configured',      { count: activeCharacters.length })
    if (pace !== 2)                 signal('pace_selected',              { pace })
    if (specificDetail.trim())      signal('specific_detail_used',       {})
    if (tonightsWant.trim())        signal('tonights_want_used',         {})
    if (mode !== defaultMode)       signal('participant_mode_overridden', { mode })
    if (mode === 'voyeur' && activePosition) signal('voyeur_context_used', { channel: perceptualChannel })
    if (mode === 'alone')           signal('alone_mode_used',            { focus: aloneFocus, discovery_risk: discoveryRisk })

    const voyeurContext = mode === 'voyeur' ? {
      watcher_position:        activePosition ?? 'nearby, unnoticed',
      perceptual_channel:      perceptualChannel,
      relationship_to_watched: activeRelationship ?? "someone you don't know well",
      interior_state:          interiorState.length ? interiorState : ['an illicit thrill'],
    } : undefined

    const aloneContext: AloneContext | undefined = mode === 'alone'
      ? { focus: aloneFocus, discovery_risk: discoveryRisk }
      : undefined

    onConfirm({
      ...baseParams,
      spark:                     activeSpark,
      characters:                mode !== 'alone' && activeCharacters.length ? activeCharacters : undefined,
      pace,
      specific_detail:           specificDetail.trim() || undefined,
      tonights_want:             tonightsWant.trim() || undefined,
      participant_mode_override: mode !== defaultMode ? mode : undefined,
      voyeur_context:            voyeurContext,
      alone_context:             aloneContext,
    })
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

  // ── Render ─────────────────────────────────────────────────────────────────

  const rosterLabel = mode === 'participant' ? 'Who\'s with you' : 'Who you\'re watching'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onSkip} />

      <div data-lenis-prevent className="relative w-full max-w-lg bg-white border-t border-gray-200 rounded-t-2xl animate-fade-up" style={{ maxHeight: '90vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="px-6 pt-5 pb-8 space-y-7">

          {/* Handle */}
          <div className="flex justify-center -mt-1">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>

          {/* Header */}
          <div className="space-y-0.5">
            <h2 className="font-serif text-2xl text-gray-900 tracking-tight">Shape this Yearn</h2>
            <p className="text-gray-400 text-xs tracking-wide">All optional — skip anything</p>
          </div>

          {/* Mode toggle — 3 way */}
          <div className="space-y-2">
            <p className="text-gray-500 text-xs tracking-widest uppercase">You are</p>
            <div className="flex border border-gray-200 rounded-sm overflow-hidden">
              {([
                { value: 'participant', label: 'In this story'      },
                { value: 'voyeur',      label: 'Watching it unfold' },
                { value: 'alone',       label: 'Alone'              },
              ] as { value: ParticipantMode; label: string }[]).map(m => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  className={`flex-1 py-3 text-sm transition-colors duration-200 ${
                    mode === m.value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── VOYEUR CONTEXT (only in voyeur mode) ───────────────────────── */}
          {mode === 'voyeur' && (
            <div className="space-y-5 border-l-2 border-gray-100 pl-4">

              {/* Watcher position */}
              <div className="space-y-2">
                <p className="text-gray-500 text-xs tracking-widest uppercase">Where are you?</p>
                <div className="flex flex-wrap gap-2">
                  {WATCHER_POSITIONS.map(pos => (
                    <button
                      key={pos}
                      onClick={() => { setWatcherPosition(prev => prev === pos ? '' : pos); setWatcherPositionFree('') }}
                      className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                        watcherPosition === pos
                          ? 'border-gray-900 text-gray-900 bg-gray-50'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={watcherPositionFree}
                  onChange={e => { setWatcherPositionFree(e.target.value); setWatcherPosition('') }}
                  placeholder="or describe your position…"
                  className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
                />
              </div>

              {/* Perceptual channel */}
              <div className="space-y-2">
                <p className="text-gray-500 text-xs tracking-widest uppercase">What can you perceive?</p>
                <div className="space-y-1.5">
                  {PERCEPTUAL_CHANNELS.map(ch => (
                    <button
                      key={ch.value}
                      onClick={() => setPerceptualChannel(ch.value)}
                      className={`w-full text-left px-3 py-2 text-xs border rounded-sm transition-colors duration-200 ${
                        perceptualChannel === ch.value
                          ? 'border-gray-900 text-gray-900 bg-gray-50'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Relationship */}
              <div className="space-y-2">
                <p className="text-gray-500 text-xs tracking-widest uppercase">Who are they to you?</p>
                <div className="flex flex-wrap gap-2">
                  {RELATIONSHIPS.map(r => (
                    <button
                      key={r}
                      onClick={() => { setRelationship(prev => prev === r ? '' : r); setRelationshipFree('') }}
                      className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                        relationship === r
                          ? 'border-gray-900 text-gray-900 bg-gray-50'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={relationshipFree}
                  onChange={e => { setRelationshipFree(e.target.value); setRelationship('') }}
                  placeholder="or describe the relationship…"
                  className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
                />
              </div>

              {/* Interior state */}
              <div className="space-y-2">
                <p className="text-gray-500 text-xs tracking-widest uppercase">How does watching make you feel?</p>
                <div className="flex flex-wrap gap-2">
                  {INTERIOR_STATES.map(s => (
                    <button
                      key={s}
                      onClick={() => toggleInteriorState(s)}
                      disabled={!interiorState.includes(s) && interiorState.length >= 2}
                      className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 disabled:opacity-30 ${
                        interiorState.includes(s)
                          ? 'border-gray-900 text-gray-900 bg-gray-50'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {interiorState.length === 2 && (
                  <p className="text-gray-300 text-xs">max 2 selected</p>
                )}
              </div>
            </div>
          )}

          {/* ── ALONE CONTEXT (only in alone mode) ─────────────────────────── */}
          {mode === 'alone' && (
            <div className="space-y-5 border-l-2 border-gray-100 pl-4">

              {/* Focus */}
              <div className="space-y-2">
                <p className="text-gray-500 text-xs tracking-widest uppercase">What's the scene?</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALONE_FOCUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAloneFocus(opt.value)}
                      className={`py-3 border rounded-sm text-center transition-colors duration-200 ${
                        aloneFocus === opt.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <p className={`text-xs font-medium ${aloneFocus === opt.value ? 'text-gray-900' : 'text-gray-500'}`}>
                        {opt.label}
                      </p>
                      <p className="text-gray-400 text-[10px] mt-0.5">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Discovery risk */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs tracking-widest uppercase">Risk of discovery</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">
                    {discoveryRisk ? 'someone could walk in — adds tension' : 'completely private'}
                  </p>
                </div>
                <button
                  onClick={() => setDiscoveryRisk(r => !r)}
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
                    discoveryRisk ? 'bg-gray-900' : 'bg-gray-200'
                  }`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                    discoveryRisk ? 'translate-x-4' : ''
                  }`} />
                </button>
              </div>
            </div>
          )}

          {/* Spark */}
          <div className="space-y-2">
            <button
              onClick={() => setShowSparks(s => !s)}
              className="flex items-center justify-between w-full text-left"
            >
              <p className="text-gray-500 text-xs tracking-widest uppercase">Spark</p>
              <span className="text-gray-300 text-xs">{showSparks ? '−' : '+'}</span>
            </button>

            {showSparks && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {visibleSparks.map(s => (
                    <button
                      key={s}
                      onClick={() => { setSpark(prev => prev === s ? null : s); setSparkFreeText('') }}
                      className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                        spark === s
                          ? 'border-gray-900 text-gray-900 bg-gray-50'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    onClick={() => { setSpark('surprise_me'); setSparkFreeText('') }}
                    className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                      spark === 'surprise_me'
                        ? 'border-gray-900 text-gray-900 bg-gray-50'
                        : 'border-gray-200 text-gray-400 hover:border-gray-400'
                    }`}
                  >
                    surprise me
                  </button>
                  {!showAllSparks && SPARKS.length > 6 && (
                    <button
                      onClick={() => setShowAllSparks(true)}
                      className="px-3 py-1.5 text-xs border border-dashed border-gray-200 text-gray-400 rounded-sm hover:border-gray-400"
                    >
                      more…
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={sparkFreeText}
                  onChange={e => { setSparkFreeText(e.target.value); setSpark(null) }}
                  placeholder="or write your own…"
                  className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
                />
              </div>
            )}
          </div>

          {/* Pace */}
          <div className="space-y-2">
            <p className="text-gray-500 text-xs tracking-widest uppercase">Pace</p>
            <div className="flex gap-2">
              {PACE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPace(opt.value)}
                  className={`flex-1 py-3 border rounded-sm text-center transition-colors duration-200 ${
                    pace === opt.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <p className={`text-xs font-medium ${pace === opt.value ? 'text-gray-900' : 'text-gray-500'}`}>
                    {opt.label}
                  </p>
                  <p className="text-gray-400 text-[10px] mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Character roster — hidden in alone mode */}
          {mode !== 'alone' && <div className="space-y-2">
            <button
              onClick={() => setShowCharacters(s => !s)}
              className="flex items-center justify-between w-full text-left"
            >
              <p className="text-gray-500 text-xs tracking-widest uppercase">{rosterLabel}</p>
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
                          onClick={() => removeCharacter(char.id)}
                          className="text-gray-300 text-xs hover:text-gray-500 transition-colors"
                        >
                          remove
                        </button>
                      )}
                    </div>

                    {/* Cast source fork — "from your cast" vs "someone new" */}
                    {savedCast.length > 0 && characterSource[char.id] === undefined && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => setCharacterSource(prev => ({ ...prev, [char.id]: 'cast' }))}
                          className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 hover:border-gray-400 transition-colors"
                        >
                          from your cast
                        </button>
                        <button
                          onClick={() => setCharacterSource(prev => ({ ...prev, [char.id]: 'new' }))}
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          someone new
                        </button>
                      </div>
                    )}

                    {/* Cast member picker */}
                    {characterSource[char.id] === 'cast' && (
                      <div className="space-y-1.5">
                        {savedCast.map(cm => (
                          <button
                            key={cm.id}
                            onClick={() => pickFromCast(char.id, cm)}
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
                        >
                          someone new instead
                        </button>
                      </div>
                    )}

                    {/* Editable fields — shown for 'new' source, or after picking from cast (editable in place) */}
                    {(characterSource[char.id] === 'new' || characterSource[char.id] === 'cast' || savedCast.length === 0) && (
                    <div className="space-y-3">

                    {/* Name */}
                    <input
                      type="text"
                      value={char.name ?? ''}
                      onChange={e => updateCharacter(char.id, { name: e.target.value || undefined })}
                      placeholder="name (optional)…"
                      className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
                    />

                    {/* Gender */}
                    <div className="flex gap-2">
                      {(['man', 'woman', 'unspecified'] as const).map(g => (
                        <button
                          key={g}
                          onClick={() => updateCharacter(char.id, { gender: g as CharacterGender, traits: [] })}
                          className={`flex-1 py-2 text-xs border rounded-sm transition-colors duration-200 ${
                            (char.gender ?? 'unspecified') === g
                              ? 'border-gray-900 text-gray-900 bg-gray-50'
                              : 'border-gray-200 text-gray-400 hover:border-gray-400'
                          }`}
                        >
                          {g === 'unspecified' ? 'story decides' : g}
                        </button>
                      ))}
                    </div>

                    {/* Traits */}
                    <div className="flex flex-wrap gap-2">
                      {getTraitsForGender((char.gender ?? 'unspecified') as CharacterGender).map(t => (
                        <button
                          key={t}
                          onClick={() => toggleTrait(char.id, t)}
                          disabled={!char.traits?.includes(t) && (char.traits?.length ?? 0) >= 2}
                          className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 disabled:opacity-30 ${
                            char.traits?.includes(t)
                              ? 'border-gray-900 text-gray-900 bg-gray-50'
                              : 'border-gray-200 text-gray-500 hover:border-gray-400'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    {(char.traits?.length ?? 0) === 2 && (
                      <p className="text-gray-300 text-xs">max 2 traits selected</p>
                    )}

                    {/* Role picker */}
                    <div className="space-y-2 pt-1">
                      <p className="text-gray-400 text-[10px] tracking-widest uppercase">Role (optional)</p>
                      {char.role && (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 text-xs border border-gray-900 text-gray-900 bg-gray-50 rounded-sm">
                            {char.role}
                          </span>
                          <button
                            onClick={() => updateCharacter(char.id, { role: undefined })}
                            className="text-gray-300 text-xs hover:text-gray-500 transition-colors"
                          >
                            clear
                          </button>
                        </div>
                      )}
                      <div className="space-y-2">
                        {[
                          { label: 'Established relationship', roles: ROLES_ESTABLISHED },
                          { label: 'Service / pretext',        roles: ROLES_SERVICE     },
                          { label: 'Proximity',                roles: ROLES_PROXIMITY   },
                        ].map(group => (
                          <div key={group.label} className="space-y-1">
                            <p className="text-gray-300 text-[10px]">{group.label}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {group.roles.map(r => (
                                <button
                                  key={r}
                                  onClick={() => updateCharacter(char.id, { role: char.role === r ? undefined : r })}
                                  className={`px-2.5 py-1 text-xs border rounded-sm transition-colors duration-200 ${
                                    char.role === r
                                      ? 'border-gray-900 text-gray-900 bg-gray-50'
                                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                                  }`}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        {/* Transgressive proximity — one tap further */}
                        <button
                          onClick={() => setShowTransgressiveRoles(prev => ({ ...prev, [char.id]: !prev[char.id] }))}
                          className="text-gray-400 text-xs hover:text-gray-600 transition-colors pt-0.5"
                        >
                          {showTransgressiveRoles[char.id] ? '− fewer roles' : '+ explore more roles'}
                        </button>
                        {showTransgressiveRoles[char.id] && (
                          <div className="space-y-1">
                            <p className="text-gray-300 text-[10px]">Transgressive proximity</p>
                            <div className="flex flex-wrap gap-1.5">
                              {ROLES_TRANSGRESSIVE.map(r => (
                                <button
                                  key={r}
                                  onClick={() => updateCharacter(char.id, { role: char.role === r ? undefined : r })}
                                  className={`px-2.5 py-1 text-xs border rounded-sm transition-colors duration-200 ${
                                    char.role === r
                                      ? 'border-gray-900 text-gray-900 bg-gray-50'
                                      : 'border-gray-200 text-gray-500 hover:border-gray-400'
                                  }`}
                                >
                                  {r}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <input
                          type="text"
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
                  <div className="space-y-1">
                    <button
                      onClick={addCharacter}
                      className="text-gray-400 text-xs border border-dashed border-gray-200 px-3 py-1.5 rounded-sm hover:border-gray-400 hover:text-gray-600 transition-colors duration-200"
                    >
                      + add another character
                    </button>
                    {characters.length >= 2 && baseParams.length_mins < 10 && (
                      <p className="text-gray-300 text-[10px]">
                        longer Yearns work better with more characters
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>}

          {/* Specific detail */}
          <div className="space-y-2">
            <p className="text-gray-500 text-xs tracking-widest uppercase">Anywhere specific?</p>
            <input
              type="text"
              maxLength={60}
              value={specificDetail}
              onChange={e => setSpecificDetail(e.target.value)}
              placeholder="rain outside, his apartment, the hotel from last year…"
              className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
            />
          </div>

          {/* Tonight's want */}
          <div className="space-y-2">
            <p className="text-gray-500 text-xs tracking-widest uppercase">What do you want from tonight?</p>
            <textarea
              maxLength={120}
              value={tonightsWant}
              onChange={e => setTonightsWant(e.target.value)}
              placeholder="to feel completely wanted, to lose track of time, to be surprised…"
              rows={2}
              className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 resize-none transition-colors duration-200 leading-relaxed"
            />
            <p className="text-right text-gray-300 text-xs">{tonightsWant.length}/120</p>
          </div>

          {/* CTAs */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleConfirm}
              className="w-full py-4 bg-gray-900 text-white font-serif text-base tracking-wide hover:bg-gray-800 transition-colors duration-200"
            >
              Write my Yearn
            </button>
            <button
              onClick={onSkip}
              className="w-full py-2 text-gray-400 text-xs tracking-widest uppercase hover:text-gray-600 transition-colors duration-200"
            >
              Skip — use my usual preferences
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
