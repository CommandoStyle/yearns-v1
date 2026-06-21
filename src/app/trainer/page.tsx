'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  SCORE_DIMENSIONS,
  FAILURE_CODES,
  type DimensionKey,
  type DimensionScores,
  type FailureCode,
  type CorpusTag,
  type QueueItem,
  type Annotation,
  type AnnotationType,
  type ReviewSubmissionResponse,
} from '@/types/trainer'

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_SCORES: DimensionScores = {
  arousal_curve:    3,
  female_desire:    3,
  character_depth:  3,
  prose_quality:    3,
  sensory_detail:   3,
  profile_fidelity: 3,
  pacing:           3,
}

// ─── Star rating component ────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`text-lg leading-none transition-colors duration-100 ${
            n <= value ? 'text-gray-900' : 'text-gray-200'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

// ─── Annotation tooltip ───────────────────────────────────────────────────────

function AnnotationPicker({
  onSelect,
  onCancel,
  style,
}: {
  onSelect: (type: AnnotationType, failureCode?: FailureCode) => void
  onCancel: () => void
  style: React.CSSProperties
}) {
  const [mode, setMode] = useState<'root' | 'flag'>('root')

  if (mode === 'flag') {
    return (
      <div
        style={style}
        className="absolute z-50 bg-white border border-gray-200 shadow-lg p-2 rounded text-xs w-56"
      >
        <p className="text-gray-400 uppercase tracking-widest text-[10px] mb-2 px-1">What's the issue?</p>
        {FAILURE_CODES.map(f => (
          <button
            key={f.code}
            onClick={() => onSelect('flag', f.code)}
            className="w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded text-gray-700"
          >
            {f.label}
          </button>
        ))}
        <button onClick={() => setMode('root')} className="w-full text-left px-2 py-1.5 text-gray-400 hover:text-gray-600">
          ← back
        </button>
      </div>
    )
  }

  return (
    <div
      style={style}
      className="absolute z-50 bg-white border border-gray-200 shadow-lg p-2 rounded text-xs flex gap-1"
    >
      <button
        onClick={() => onSelect('gold')}
        className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100"
      >
        ✦ Gold
      </button>
      <button
        onClick={() => setMode('flag')}
        className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100"
      >
        ⚑ Flag
      </button>
      <button
        onClick={() => onSelect('comment')}
        className="px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded hover:bg-gray-100"
      >
        ✎ Note
      </button>
      <button onClick={onCancel} className="px-2 py-1.5 text-gray-300 hover:text-gray-500">✕</button>
    </div>
  )
}

// ─── Story text with annotation support ───────────────────────────────────────

function AnnotatedStory({
  text,
  annotations,
  onAnnotationAdd,
}: {
  text: string
  annotations: Annotation[]
  onAnnotationAdd: (a: Annotation) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pickerState, setPickerState] = useState<{
    visible: boolean
    x: number
    y: number
    start: number
    end: number
    selectedText: string
  } | null>(null)

  function handleMouseUp() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !containerRef.current) return

    const range = sel.getRangeAt(0)
    const containerText = containerRef.current.textContent ?? ''

    // Get character offsets relative to the container
    const preRange = document.createRange()
    preRange.selectNodeContents(containerRef.current)
    preRange.setEnd(range.startContainer, range.startOffset)
    const start = preRange.toString().length
    const end = start + range.toString().length
    const selectedText = containerText.slice(start, end).trim()
    if (!selectedText) return

    const rect = range.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()

    setPickerState({
      visible: true,
      x: rect.left - containerRect.left,
      y: rect.bottom - containerRect.top + 4,
      start,
      end,
      selectedText,
    })
  }

  function handlePickerSelect(type: AnnotationType, failureCode?: FailureCode) {
    if (!pickerState) return
    const annotation: Annotation = {
      id:           Math.random().toString(36).slice(2),
      type,
      start:        pickerState.start,
      end:          pickerState.end,
      text:         pickerState.selectedText,
      ...(failureCode && { failure_code: failureCode }),
    }
    onAnnotationAdd(annotation)
    setPickerState(null)
    window.getSelection()?.removeAllRanges()
  }

  // Build annotated spans
  const spans: { text: string; annotationType?: AnnotationType; failureCode?: FailureCode }[] = []
  if (annotations.length === 0) {
    spans.push({ text })
  } else {
    const sorted = [...annotations].sort((a, b) => a.start - b.start)
    let cursor = 0
    for (const ann of sorted) {
      if (ann.start > cursor) spans.push({ text: text.slice(cursor, ann.start) })
      spans.push({ text: text.slice(ann.start, ann.end), annotationType: ann.type, failureCode: ann.failure_code })
      cursor = ann.end
    }
    if (cursor < text.length) spans.push({ text: text.slice(cursor) })
  }

  const paragraphs = text.split(/\n+/).filter(Boolean)

  return (
    <div className="relative" ref={containerRef} onMouseUp={handleMouseUp}>
      {pickerState?.visible && (
        <AnnotationPicker
          style={{ top: pickerState.y, left: pickerState.x }}
          onSelect={handlePickerSelect}
          onCancel={() => { setPickerState(null); window.getSelection()?.removeAllRanges() }}
        />
      )}
      {paragraphs.map((para, i) => (
        <p
          key={i}
          style={{
            fontFamily:   "'EB Garamond', Georgia, serif",
            fontSize:     '1.0625rem',
            lineHeight:   '2rem',
            color:        'rgba(0,0,0,0.85)',
            marginBottom: 0,
            textIndent:   i === 0 ? 0 : '2em',
          }}
        >
          {para}
        </p>
      ))}
      {/* Overlay annotation highlights (simplified — marks all instances of annotated text) */}
      {spans.filter(s => s.annotationType).map((s, i) => (
        <mark
          key={i}
          title={s.failureCode ?? s.annotationType}
          className={`rounded-sm ${
            s.annotationType === 'gold'    ? 'bg-amber-100 text-amber-900' :
            s.annotationType === 'flag'    ? 'bg-red-100 text-red-900' :
            'bg-blue-50 text-blue-900'
          }`}
        >
          {s.text}
        </mark>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'ready' | 'empty' | 'submitting' | 'submitted' | 'error'

export default function TrainerDashboard() {
  const { session } = useAuth()
  const authToken = session?.access_token ?? null

  const [pageState, setPageState]     = useState<PageState>('loading')
  const [story, setStory]             = useState<QueueItem | null>(null)
  const [scores, setScores]           = useState<DimensionScores>({ ...EMPTY_SCORES })
  const [reread, setReread]           = useState(false)
  const [failureCodes, setFailureCodes] = useState<FailureCode[]>([])
  const [corpusTag, setCorpusTag]     = useState<CorpusTag>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [notes, setNotes]             = useState('')
  const [submitResult, setSubmitResult] = useState<ReviewSubmissionResponse | null>(null)
  const [errorMsg, setErrorMsg]       = useState('')
  const [sessionCount, setSessionCount] = useState(0)

  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / SCORE_DIMENSIONS.length

  const fetchNext = useCallback(async () => {
    if (!authToken) return
    setPageState('loading')
    setStory(null)
    setScores({ ...EMPTY_SCORES })
    setReread(false)
    setFailureCodes([])
    setCorpusTag(null)
    setAnnotations([])
    setNotes('')
    setSubmitResult(null)

    const res = await fetch('/api/trainer/reviews?action=queue', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    if (!res.ok) { setPageState('error'); setErrorMsg(`Queue fetch failed: ${res.status}`); return }
    const data = await res.json() as { story?: QueueItem; message?: string }
    if (!data.story) { setPageState('empty'); return }
    setStory(data.story)
    setPageState('ready')
  }, [authToken])

  useEffect(() => { fetchNext() }, [fetchNext])

  function toggleFailureCode(code: FailureCode) {
    setFailureCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  async function handleSubmit() {
    if (!story || !authToken || pageState === 'submitting') return
    setPageState('submitting')

    const res = await fetch('/api/trainer/reviews', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        story_id:      story.story_id,
        queue_id:      story.queue_id,
        scores,
        reread,
        failure_codes: failureCodes,
        corpus_tag:    corpusTag,
        annotations,
        notes,
      }),
    })

    if (!res.ok) {
      setPageState('error')
      setErrorMsg(`Submit failed: ${res.status}`)
      return
    }

    const result = await res.json() as ReviewSubmissionResponse
    setSubmitResult(result)
    setSessionCount(n => n + 1)
    setPageState('submitted')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm tracking-widest uppercase animate-pulse">Loading…</p>
      </div>
    )
  }

  if (pageState === 'empty') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <p className="font-serif text-2xl text-gray-900">Queue is empty</p>
        <p className="text-gray-400 text-sm">No stories waiting for review.</p>
        <a
          href="/admin/queue"
          className="px-6 py-2 border border-gray-300 text-gray-600 text-xs tracking-widest uppercase hover:border-gray-600 transition-colors"
        >
          Populate queue →
        </a>
        {sessionCount > 0 && (
          <p className="text-gray-400 text-xs">{sessionCount} reviews this session</p>
        )}
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500 text-sm">{errorMsg}</p>
        <button onClick={fetchNext} className="text-gray-600 text-xs tracking-widest uppercase border border-gray-300 px-4 py-2 hover:border-gray-600 transition-colors">
          Try again
        </button>
      </div>
    )
  }

  if (pageState === 'submitted' && submitResult) {
    return (
      <div className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-lg space-y-8 text-center">
          <p className="font-serif text-3xl text-gray-900">Submitted</p>
          <div className="space-y-2">
            <p className="text-gray-500 text-sm">Session avg: <span className="text-gray-900 font-medium">{submitResult.session_stats?.avg_score_this_session?.toFixed(2)}</span></p>
            {submitResult.session_stats && (
              <div className="text-xs text-gray-400 space-y-1 text-left border border-gray-100 px-4 py-3">
                <p>Today: {submitResult.session_stats.reviewed_today} reviewed</p>
                <p>Session avg: {submitResult.session_stats.avg_score_this_session?.toFixed(2)}</p>
                <p>Gold this session: {submitResult.session_stats.gold_this_session}</p>
                {submitResult.session_stats.top_failure_this_session && (
                  <p>Top issue: {submitResult.session_stats.top_failure_this_session}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={fetchNext}
              className="px-8 py-3 bg-gray-900 text-white text-xs tracking-widest uppercase hover:bg-gray-700 transition-colors"
            >
              Next story
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 border border-gray-200 text-gray-500 text-xs tracking-widest uppercase hover:border-gray-400 transition-colors"
            >
              End session
            </button>
          </div>
          {sessionCount > 0 && (
            <p className="text-gray-300 text-xs">{sessionCount} {sessionCount === 1 ? 'review' : 'reviews'} this session</p>
          )}
        </div>
      </div>
    )
  }

  // ── Main review UI ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">

      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-serif text-gray-900 text-lg">Trainer</span>
          {story?.blind_review && (
            <span className="text-xs text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">Blind</span>
          )}
          <span className="text-xs text-gray-400">
            Level {story?.explicitness} · {story?.length_mins}min · {story?.language?.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {sessionCount > 0 && (
            <span className="text-gray-300 text-xs">{sessionCount} this session</span>
          )}
          <a href="/admin/queue" className="text-gray-400 text-xs hover:text-gray-600 transition-colors">Queue →</a>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-49px)]">

        {/* Story panel */}
        <div className="flex-1 px-8 py-10 overflow-y-auto">
          <div className="mx-auto max-w-2xl">
            {story?.story_text ? (
              <AnnotatedStory
                text={story.story_text}
                annotations={annotations}
                onAnnotationAdd={a => setAnnotations(prev => [...prev, a])}
              />
            ) : (
              <p className="text-gray-400 text-sm font-serif italic">
                Story text unavailable — it may not have been uploaded to storage yet.
              </p>
            )}

            {/* Annotation list */}
            {annotations.length > 0 && (
              <div className="mt-10 border-t border-gray-100 pt-6 space-y-2">
                <p className="text-gray-400 text-xs tracking-widest uppercase">Annotations</p>
                {annotations.map(a => (
                  <div key={a.id} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      a.type === 'gold'    ? 'bg-amber-100 text-amber-700' :
                      a.type === 'flag'    ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {a.type === 'flag' ? (a.failure_code ?? 'flag') : a.type}
                    </span>
                    <span className="text-gray-500 truncate max-w-xs">"{a.text}"</span>
                    <button
                      onClick={() => setAnnotations(prev => prev.filter(x => x.id !== a.id))}
                      className="ml-auto text-gray-300 hover:text-gray-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scoring sidebar */}
        <div className="w-80 border-l border-gray-100 px-6 py-8 space-y-8 overflow-y-auto flex-shrink-0">

          {/* Dimension scores */}
          <div className="space-y-4">
            <p className="text-gray-400 text-xs tracking-widest uppercase">Scores</p>
            {SCORE_DIMENSIONS.map(dim => (
              <div key={dim.key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 w-36">{dim.label}</span>
                <StarRating
                  value={scores[dim.key as DimensionKey]}
                  onChange={v => setScores(prev => ({ ...prev, [dim.key]: v }))}
                />
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-xs text-gray-400">Avg</span>
              <span className="text-gray-900 font-medium text-sm">{avgScore.toFixed(2)}</span>
            </div>
          </div>

          {/* Would reread */}
          <div className="space-y-2">
            <p className="text-gray-400 text-xs tracking-widest uppercase">Would you reread this?</p>
            <div className="flex gap-2">
              {[true, false].map(v => (
                <button
                  key={String(v)}
                  onClick={() => setReread(v)}
                  className={`flex-1 py-2 text-xs border rounded-sm transition-colors ${
                    reread === v
                      ? 'border-gray-900 text-gray-900 bg-gray-50'
                      : 'border-gray-200 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          </div>

          {/* Failure codes */}
          <div className="space-y-2">
            <p className="text-gray-400 text-xs tracking-widest uppercase">Issues <span className="normal-case">(select all that apply)</span></p>
            <div className="space-y-1.5">
              {FAILURE_CODES.map(f => (
                <button
                  key={f.code}
                  onClick={() => toggleFailureCode(f.code)}
                  title={f.description}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                    failureCodes.includes(f.code)
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'text-gray-500 border border-gray-100 hover:border-gray-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Corpus tag */}
          <div className="space-y-2">
            <p className="text-gray-400 text-xs tracking-widest uppercase">Corpus tag</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([null, 'gold', 'regen', 'discard'] as CorpusTag[]).map(tag => (
                <button
                  key={tag ?? 'none'}
                  onClick={() => setCorpusTag(tag)}
                  className={`py-2 text-xs border rounded-sm transition-colors ${
                    corpusTag === tag
                      ? tag === 'gold'    ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : tag === 'discard' ? 'border-red-300 bg-red-50 text-red-700'
                      : tag === 'regen'   ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-400 bg-gray-50 text-gray-700'
                    : 'border-gray-200 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {tag === null ? 'None' : tag.charAt(0).toUpperCase() + tag.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <p className="text-gray-400 text-xs tracking-widest uppercase">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Optional qualitative notes…"
              className="w-full text-sm text-gray-700 border border-gray-200 p-2 focus:outline-none focus:border-gray-400 resize-none placeholder:text-gray-300"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={pageState === 'submitting'}
            className="w-full py-3 bg-gray-900 text-white text-xs tracking-widest uppercase hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            {pageState === 'submitting' ? 'Submitting…' : 'Submit review'}
          </button>

          {/* Skip without reviewing */}
          <button
            onClick={fetchNext}
            className="w-full text-gray-300 text-xs tracking-widest uppercase hover:text-gray-500 transition-colors"
          >
            Skip this story
          </button>

        </div>
      </div>
    </div>
  )
}
