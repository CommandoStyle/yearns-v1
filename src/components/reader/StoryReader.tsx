'use client'

import { useEffect, useRef, useState } from 'react'
import { ExplicitnessDial } from './ExplicitnessDial'
import type { YearnState } from '@/hooks/useYearn'
import type { ExplicitnessLevel } from '@/lib/prompt-engine'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'pro_required'

interface StoryReaderProps {
  state:                YearnState
  onCancel:             () => void
  onReset:              () => void
  onAdjustExplicitness: (level: ExplicitnessLevel) => void
  currentExplicitness:  ExplicitnessLevel
  // Save support
  authToken:            string | null
  isPro:                boolean
  generationMeta?: {
    setting?:       string
    explicitness?:  number
    length_mins?:   number
  }
}

export function StoryReader({
  state,
  onCancel,
  onReset,
  onAdjustExplicitness,
  currentExplicitness,
  authToken,
  isPro,
  generationMeta,
}: StoryReaderProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  async function handleSave() {
    if (saveStatus === 'saving' || saveStatus === 'saved') return
    if (!isPro) { setSaveStatus('pro_required'); return }
    if (!authToken || !state.text) return

    setSaveStatus('saving')
    try {
      const res = await fetch('/api/yearns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          text:           state.text,
          word_count:     state.wordCount,
          prompt_version: state.promptVersion,
          setting:        generationMeta?.setting,
          explicitness:   generationMeta?.explicitness,
          length_mins:    generationMeta?.length_mins,
        }),
      })
      setSaveStatus(res.ok ? 'saved' : res.status === 402 ? 'pro_required' : 'error')
    } catch {
      setSaveStatus('error')
    }
  }

  // Reset save status when a new story starts
  useEffect(() => {
    if (state.status === 'generating') setSaveStatus('idle')
  }, [state.status])

  // Auto-scroll to bottom while generating
  useEffect(() => {
    if (state.status === 'generating') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [state.text, state.status])

  const paragraphs = state.text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)

  const isGenerating = state.status === 'generating'
  const isDone       = state.status === 'done'
  const isCancelled  = state.status === 'cancelled'
  const isError      = state.status === 'error'
  const hasText      = state.text.length > 0

  return (
    <div className="flex flex-col min-h-screen">

      {/* Story area */}
      <main className="flex-1 px-6 pt-16 pb-36">
        <div className="mx-auto max-w-2xl">

          {/* Story text */}
          {hasText && (
            <div data-yn-build="v8">
              {paragraphs.map((para, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: "'EB Garamond', Georgia, serif",
                    fontSize: '1.125rem',
                    lineHeight: '2.25rem',
                    letterSpacing: '0.01em',
                    color: 'rgba(0,0,0,0.9)',
                    margin: 0,
                    padding: 0,
                    textIndent: i === 0 ? 0 : '2em',
                  }}
                >
                  {para}
                  {isGenerating && i === paragraphs.length - 1 && (
                    <span className="inline-block w-px h-5 ml-0.5 bg-gray-600/70 align-middle animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Generating but no paragraphs yet — show pulse placeholder */}
          {isGenerating && !hasText && (
            <div className="space-y-4 animate-pulse">
              <div className="h-5 bg-gray-900/8 rounded w-full" />
              <div className="h-5 bg-gray-900/8 rounded w-11/12" />
              <div className="h-5 bg-gray-900/8 rounded w-4/5" />
            </div>
          )}

          {/* Completion metadata */}
          {isDone && (
            <p className="mt-10 text-gray-900/25 text-xs tracking-widest uppercase text-right">
              {state.wordCount.toLocaleString()} words
            </p>
          )}

          {/* Cancelled notice */}
          {isCancelled && hasText && (
            <p className="mt-10 text-gray-900/25 text-xs tracking-widest uppercase text-right">
              Generation stopped · {state.wordCount.toLocaleString()} words
            </p>
          )}

          {/* Error state */}
          {isError && (
            <div className="mt-16 text-center space-y-6">
              <p className="text-gray-900/40 font-serif text-lg">
                {state.errorMessage ?? 'Something went wrong.'}
              </p>
              <button
                onClick={onReset}
                className="px-8 py-3 border border-gray-600/40 text-gray-600/80 text-sm tracking-widest uppercase hover:border-gray-600/70 hover:text-gray-600 transition-all duration-200"
              >
                Try again
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 inset-x-0 border-t border-gray-900/8 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl px-6 py-4">

          {isGenerating && (
            <div className="flex items-center gap-4">
              <ExplicitnessDial
                value={currentExplicitness}
                onChange={onAdjustExplicitness}
                compact
                disabled
              />
              <button
                onClick={onCancel}
                className="ml-auto text-gray-900/35 text-xs tracking-widest uppercase hover:text-gray-900/60 transition-colors duration-200"
              >
                Stop
              </button>
            </div>
          )}

          {(isDone || isCancelled) && (
            <div className="flex items-center gap-3">
              <ExplicitnessDial
                value={currentExplicitness}
                onChange={onAdjustExplicitness}
                compact
              />
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                  title={!isPro ? 'Save — available in Pro' : undefined}
                  className={`text-xs tracking-widest uppercase transition-colors duration-200 ${
                    saveStatus === 'saved'
                      ? 'text-gray-900/50 cursor-default'
                      : saveStatus === 'saving'
                      ? 'text-gray-900/30 cursor-default'
                      : saveStatus === 'pro_required'
                      ? 'text-amber-600/70 hover:text-amber-600'
                      : saveStatus === 'error'
                      ? 'text-red-500/70 hover:text-red-500'
                      : isPro
                      ? 'text-gray-900/50 hover:text-gray-900/80'
                      : 'text-gray-900/25 hover:text-gray-900/40'
                  }`}
                >
                  {saveStatus === 'saving'      ? 'Saving…'
                   : saveStatus === 'saved'     ? 'Saved'
                   : saveStatus === 'error'     ? 'Error — retry'
                   : saveStatus === 'pro_required' ? 'Pro only'
                   : 'Save'}
                </button>
                <button
                  onClick={onReset}
                  className="px-5 py-2 border border-gray-600/50 text-gray-600 text-xs tracking-widest uppercase hover:bg-gray-600/8 transition-all duration-200"
                >
                  New Yearn
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
