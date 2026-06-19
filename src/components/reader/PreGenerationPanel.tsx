'use client'

import { useState } from 'react'
import type { GenerateParams } from '@/hooks/useYearn'
import type { Genre } from '@/lib/prompt-engine'

// ─── Curated content ──────────────────────────────────────────────────────────

const SPARKS: { text: string; genres: Genre[] }[] = [
  { text: 'a text that shouldn\'t have been sent',       genres: ['contemporary', 'romantic'] },
  { text: 'running into him again, somewhere unexpected', genres: ['contemporary', 'romantic'] },
  { text: 'the morning after',                           genres: ['contemporary', 'dark'] },
  { text: 'working late — just the two of them',         genres: ['contemporary', 'workplace'] as Genre[] },
  { text: 'coming home to find him waiting',             genres: ['contemporary', 'romantic'] },
  { text: 'a secret finally said out loud',              genres: ['romantic', 'dark'] },
  { text: 'a look that said everything',                 genres: ['romantic', 'contemporary'] },
  { text: 'a dance that lasted too long',                genres: ['romantic', 'historical'] },
  { text: 'a letter delivered by mistake',               genres: ['historical', 'romantic'] },
  { text: 'two strangers, one storm',                    genres: ['historical', 'fantasy'] },
  { text: 'a debt repaid in an unexpected way',          genres: ['dark', 'historical'] },
  { text: 'the night before everything changed',         genres: ['dark', 'scifi'] },
  { text: 'a door left open',                            genres: ['contemporary', 'dark'] },
  { text: 'a touch that lasted a beat too long',         genres: ['romantic', 'contemporary'] },
  { text: 'the moment the rules stopped mattering',      genres: ['dark', 'fantasy'] },
  { text: 'a chance meeting that felt like fate',        genres: ['romantic', 'scifi'] },
]

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

const PACE_OPTIONS: { value: 1 | 2 | 3; label: string; sub: string }[] = [
  { value: 1, label: 'Lingering',   sub: 'slow burn, let it ache' },
  { value: 2, label: 'Building',    sub: 'tension, then release' },
  { value: 3, label: 'Inevitable',  sub: 'compressed, urgent' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface PreGenerationPanelProps {
  baseParams:    GenerateParams
  topGenre?:     Genre
  defaultMode?:  'participant' | 'voyeur'
  onConfirm:     (params: GenerateParams) => void
  onSkip:        () => void
  authToken:     string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PreGenerationPanel({
  baseParams,
  topGenre,
  defaultMode = 'participant',
  onConfirm,
  onSkip,
  authToken,
}: PreGenerationPanelProps) {
  const [mode, setMode]               = useState<'participant' | 'voyeur'>(defaultMode)
  const [spark, setSpark]             = useState<string | null>(null)
  const [sparkFreeText, setSparkFreeText] = useState('')
  const [showAllSparks, setShowAllSparks] = useState(false)
  const [showSparks, setShowSparks]   = useState(false) // collapsed by default, open on interact
  const [name, setName]               = useState('')
  const [traits, setTraits]           = useState<string[]>([])
  const [showCharacter, setShowCharacter] = useState(false)
  const [pace, setPace]               = useState<1 | 2 | 3>(2)
  const [specificDetail, setSpecificDetail] = useState('')
  const [tonightsWant, setTonightsWant]     = useState('')

  // Sort sparks — top genre first
  const sortedSparks = [...SPARKS].sort((a, b) => {
    const aMatch = topGenre && a.genres.includes(topGenre) ? -1 : 0
    const bMatch = topGenre && b.genres.includes(topGenre) ? -1 : 0
    return aMatch - bMatch
  })
  const visibleSparks = showAllSparks ? sortedSparks : sortedSparks.slice(0, 6)

  function toggleTrait(t: string) {
    setTraits(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : prev.length < 2 ? [...prev, t] : prev
    )
  }

  function handleConfirm() {
    const activeSpark = sparkFreeText.trim() || spark || undefined

    // Fire implicit signals for any field used
    if (activeSpark)            signal('spark_selected',           { spark: activeSpark })
    if (name || traits.length)  signal('character_override_used',  { has_name: !!name, trait_count: traits.length })
    if (pace !== 2)             signal('pace_selected',            { pace })
    if (specificDetail.trim())  signal('specific_detail_used',     {})
    if (tonightsWant.trim())    signal('tonights_want_used',       {})
    if (mode !== defaultMode)   signal('participant_mode_overridden', { mode })

    onConfirm({
      ...baseParams,
      spark:                     activeSpark,
      character_override:        (name || traits.length) ? { name: name.trim() || undefined, traits: traits.length ? traits : undefined } : undefined,
      pace,
      specific_detail:           specificDetail.trim() || undefined,
      tonights_want:             tonightsWant.trim() || undefined,
      participant_mode_override: mode !== defaultMode ? mode : undefined,
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onSkip} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-white border-t border-gray-200 rounded-t-2xl overflow-y-auto max-h-[92dvh] animate-fade-up">
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

          {/* Participant / Voyeur toggle */}
          <div className="space-y-2">
            <p className="text-gray-500 text-xs tracking-widest uppercase">You are</p>
            <div className="flex border border-gray-200 rounded-sm overflow-hidden">
              {(['participant', 'voyeur'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-3 text-sm transition-colors duration-200 ${
                    mode === m
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {m === 'participant' ? 'In this story' : 'Watching it unfold'}
                </button>
              ))}
            </div>
          </div>

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
                      key={s.text}
                      onClick={() => { setSpark(prev => prev === s.text ? null : s.text); setSparkFreeText('') }}
                      className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                        spark === s.text
                          ? 'border-gray-900 text-gray-900 bg-gray-50'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {s.text}
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
                    pace === opt.value
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-400'
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

          {/* Today's other character */}
          <div className="space-y-2">
            <button
              onClick={() => setShowCharacter(s => !s)}
              className="flex items-center justify-between w-full text-left"
            >
              <p className="text-gray-500 text-xs tracking-widest uppercase">Today's other character</p>
              <span className="text-gray-300 text-xs">{showCharacter ? '−' : '+'}</span>
            </button>

            {showCharacter && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="his name (optional)…"
                  className="w-full bg-transparent border-b border-gray-200 focus:border-gray-500 outline-none text-sm text-gray-800 placeholder:text-gray-300 py-1.5 transition-colors duration-200"
                />
                <div className="flex flex-wrap gap-2">
                  {TRAITS.map(t => (
                    <button
                      key={t}
                      onClick={() => toggleTrait(t)}
                      disabled={!traits.includes(t) && traits.length >= 2}
                      className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 disabled:opacity-30 ${
                        traits.includes(t)
                          ? 'border-gray-900 text-gray-900 bg-gray-50'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {traits.length === 2 && (
                  <p className="text-gray-300 text-xs">max 2 traits selected</p>
                )}
              </div>
            )}
          </div>

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
