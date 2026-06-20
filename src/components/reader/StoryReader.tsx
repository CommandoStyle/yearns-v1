'use client'

import { useEffect, useRef } from 'react'
import { ExplicitnessDial } from './ExplicitnessDial'
import type { YearnState } from '@/hooks/useYearn'
import type { ExplicitnessLevel } from '@/lib/prompt-engine'

interface StoryReaderProps {
  state:                YearnState
  onCancel:             () => void
  onReset:              () => void
  onAdjustExplicitness: (level: ExplicitnessLevel) => void
  currentExplicitness:  ExplicitnessLevel
}

export function StoryReader({
  state,
  onCancel,
  onReset,
  onAdjustExplicitness,
  currentExplicitness,
}: StoryReaderProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom while generating
  useEffect(() => {
    if (state.status === 'generating') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [state.text, state.status])

  const paragraphs = state.text
    .split(/\n\n+/)
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
            <div>
              {paragraphs.map((para, i) => (
                <p
                  key={i}
                  className={`font-serif text-gray-900/90 text-lg leading-9 tracking-[0.01em] ${
                    i === 0 ? '' : 'indent-8'
                  }`}
                >
                  {para}
                  {/* Blinking cursor appended to the last paragraph only */}
                  {isGenerating && i === paragraphs.length - 1 && (
                    <span className="inline-block w-px h-5 ml-0.5 bg-gray-600/70 align-middle animate-pulse" />
                  )}
                </p>
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
                {/* Save — Pro feature, placeholder for now */}
                <button
                  disabled
                  className="text-gray-900/20 text-xs tracking-widest uppercase cursor-not-allowed"
                  title="Save — available in Pro"
                >
                  Save
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
