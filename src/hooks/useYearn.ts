/**
 * Yearns — useYearn hook
 * Manages the full lifecycle of a Yearn generation on the client side.
 *
 * Responsibilities:
 *   - POST to /api/generate and establish SSE connection
 *   - Stream tokens into React state as they arrive
 *   - Handle all error codes with typed, actionable results
 *   - Expose generation state (idle → generating → done → error)
 *   - Allow cancellation mid-generation
 *   - Report implicit signals (word count, completion) back to profile engine
 *
 * Design decisions:
 *   - Uses fetch + ReadableStream over EventSource because EventSource
 *     does not support POST requests or custom headers (auth token).
 *   - State is a discriminated union — no separate boolean flags
 *     like `isLoading` that can go stale. The `status` field is truth.
 *   - Cancellation uses AbortController — cleans up the fetch AND
 *     signals to the server (though server handles disconnect gracefully).
 *   - Accumulated text is stored in a ref during streaming to avoid
 *     re-renders on every token. React state is updated in batches
 *     (every ~50ms via a flush interval) for readable performance.
 */

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type {
  ExplicitnessLevel,
  SettingType,
  SupportedLanguage,
} from '@/lib/prompt-engine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type YearnStatus =
  | 'idle'
  | 'generating'
  | 'transitioning'   // mid-read dial change: frozen text visible, new generation pending
  | 'done'
  | 'error'
  | 'cancelled'

export type YearnErrorCode =
  | 'unauthenticated'       // → redirect to login
  | 'age_verification_required'  // → redirect to age gate
  | 'free_limit_reached'    // → show upgrade prompt
  | 'rate_limited'          // → show cooldown message
  | 'content_policy'        // → show policy message (non-alarming)
  | 'output_policy'         // → show "try again" (story was discarded)
  | 'stream_error'          // → generic retry
  | 'network_error'         // → check connection
  | 'unknown'

export interface YearnState {
  status: YearnStatus
  text: string              // accumulated story text so far
  wordCount: number
  promptVersion: string | null
  error: YearnErrorCode | null
  errorMessage: string | null
}

export interface GenerateParams {
  explicitness: ExplicitnessLevel
  setting: SettingType
  length_mins: number
  participant_mode?: import('@/lib/prompt-engine').ParticipantMode
  continuation_id?: string
  continuation_context_direct?: string  // mid-read dial: caller provides frozen tail directly
  previous_explicitness?: ExplicitnessLevel  // mid-read dial: for transition instruction
  language?: SupportedLanguage
  // Per-story overrides from pre-generation panel
  spark?: string
  characters?: import('@/lib/prompt-engine').CharacterConfig[]
  pace?: 1 | 2 | 3
  specific_detail?: string
  current_yearning?: string
  participant_mode_override?: import('@/lib/prompt-engine').ParticipantMode
  voyeur_context?: import('@/lib/prompt-engine').VoyeurContext
  alone_context?: import('@/lib/prompt-engine').AloneContext
  outfit?: string
}

export interface UseYearnReturn {
  state: YearnState
  generate: (params: GenerateParams) => Promise<void>
  cancel: () => void
  reset: () => void
  adjustExplicitness: (level: ExplicitnessLevel) => void
  // Mid-read dial change: freeze text at furthestReadOffset, regenerate continuation
  // at the new explicitness level, appending to frozen text seamlessly.
  midReadGenerate: (
    frozenText: string,
    newLevel: ExplicitnessLevel,
    prevLevel: ExplicitnessLevel,
    params: GenerateParams,
  ) => Promise<void>
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: YearnState = {
  status: 'idle',
  text: '',
  wordCount: 0,
  promptVersion: null,
  error: null,
  errorMessage: null,
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useYearn(authToken: string | null): UseYearnReturn {
  const [state, setState] = useState<YearnState>(INITIAL_STATE)

  // Refs used during streaming — avoids React re-renders on every token
  const textBufferRef = useRef<string>('')
  const abortRef = useRef<AbortController | null>(null)
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentExplicitnessRef = useRef<ExplicitnessLevel>(2)

  // ── Cleanup ──────────────────────────────────────────────────────────────

  const stopFlushInterval = useCallback(() => {
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current)
      flushIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      // Clean up on unmount
      abortRef.current?.abort()
      stopFlushInterval()
    }
  }, [stopFlushInterval])

  // ── Cancel ───────────────────────────────────────────────────────────────

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    stopFlushInterval()

    // Flush whatever text we have before marking cancelled
    const finalText = textBufferRef.current
    setState(prev => ({
      ...prev,
      status: 'cancelled',
      text: finalText,
      wordCount: finalText.trim().split(/\s+/).filter(Boolean).length,
    }))
  }, [stopFlushInterval])

  // ── Reset ────────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    abortRef.current?.abort()
    stopFlushInterval()
    textBufferRef.current = ''
    setState(INITIAL_STATE)
  }, [stopFlushInterval])

  // ── Adjust explicitness (mid-story signal) ───────────────────────────────

  const adjustExplicitness = useCallback((level: ExplicitnessLevel) => {
    currentExplicitnessRef.current = level
    // Signal is stored for the next generation — no restart.
    // In a future version, this could trigger a style-shift prompt injection.
    // Record as an implicit signal for profile learning.
    recordImplicitSignal('explicitness_adjusted', { level }, authToken)
  }, [authToken])

  // ── Generate ─────────────────────────────────────────────────────────────

  const generate = useCallback(async (params: GenerateParams) => {
    if (!authToken) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'unauthenticated',
        errorMessage: null,
      }))
      return
    }

    // Cancel any in-progress generation
    abortRef.current?.abort()
    stopFlushInterval()

    // Reset buffer and state
    textBufferRef.current = ''
    currentExplicitnessRef.current = params.explicitness
    setState({
      status: 'generating',
      text: '',
      wordCount: 0,
      promptVersion: null,
      error: null,
      errorMessage: null,
    })

    const abort = new AbortController()
    abortRef.current = abort

    // Batch-flush buffer to React state every 50ms during streaming.
    // This gives smooth reading UX without re-rendering on every token
    // (Claude streams ~30–50 tokens/second — per-token re-render would jank).
    flushIntervalRef.current = setInterval(() => {
      const currentText = textBufferRef.current
      if (currentText) {
        setState(prev => ({ ...prev, text: currentText }))
      }
    }, 50)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(params),
        signal: abort.signal,
      })

      // Non-2xx before stream starts = structured JSON error
      if (!response.ok) {
        stopFlushInterval()
        let errorCode: YearnErrorCode = 'unknown'
        try {
          const err = await response.json() as { error?: string }
          errorCode = (err.error as YearnErrorCode) ?? 'unknown'
        } catch { /* unparseable body */ }

        setState(prev => ({
          ...prev,
          status: 'error',
          error: errorCode,
          errorMessage: getFriendlyError(errorCode),
        }))
        return
      }

      // ── Parse SSE stream ─────────────────────────────────────────────────
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE messages are separated by double newlines
        const messages = buffer.split('\n\n')
        buffer = messages.pop() ?? ''  // last element may be incomplete

        for (const message of messages) {
          if (!message.trim()) continue

          const lines = message.split('\n')
          let eventType = 'message'
          let dataLine = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              dataLine = line.slice(6).trim()
            }
          }

          if (!dataLine) continue

          let parsed: unknown
          try {
            parsed = JSON.parse(dataLine)
          } catch {
            continue  // malformed data line — skip
          }

          switch (eventType) {
            case 'token': {
              const { t } = parsed as { t: string }
              textBufferRef.current += t
              break
            }

            case 'done': {
              stopFlushInterval()
              const { word_count, prompt_version } = parsed as {
                word_count: number
                prompt_version: string
              }
              const finalText = textBufferRef.current
              setState({
                status: 'done',
                text: finalText,
                wordCount: word_count,
                promptVersion: prompt_version,
                error: null,
                errorMessage: null,
              })
              // Record completion signal for profile learning
              recordImplicitSignal('generation_completed', { word_count }, authToken)
              break
            }

            case 'error': {
              stopFlushInterval()
              const { code } = parsed as { code: YearnErrorCode }
              setState(prev => ({
                ...prev,
                status: 'error',
                text: textBufferRef.current, // preserve whatever was generated
                error: code,
                errorMessage: getFriendlyError(code),
              }))
              break
            }
          }
        }
      }

    } catch (err) {
      stopFlushInterval()

      if ((err as Error).name === 'AbortError') {
        // Cancellation — already handled by cancel() above
        return
      }

      setState(prev => ({
        ...prev,
        status: 'error',
        text: textBufferRef.current,
        error: 'network_error',
        errorMessage: getFriendlyError('network_error'),
      }))
    }
  }, [authToken, stopFlushInterval])

  // ── Mid-read explicitness dial ───────────────────────────────────────────
  // Called when the reader changes the dial while a story is active or done.
  // frozenText: story text up to furthestReadOffset (the reader's high-water mark)
  // The new generation streams tokens that append directly onto frozenText.

  const midReadGenerate = useCallback(async (
    frozenText: string,
    newLevel: ExplicitnessLevel,
    prevLevel: ExplicitnessLevel,
    params: GenerateParams,
  ) => {
    if (!authToken) return

    // Cancel any in-flight stream
    abortRef.current?.abort()
    stopFlushInterval()

    // Seed the buffer with frozen text — new tokens append from here
    textBufferRef.current = frozenText
    currentExplicitnessRef.current = newLevel

    // Show transitioning state: frozen text visible, regeneration pending
    const transitionCopy = newLevel > prevLevel ? 'Deepening...' : 'Easing back...'
    setState({
      status: 'transitioning',
      text: frozenText,
      wordCount: frozenText.trim().split(/\s+/).filter(Boolean).length,
      promptVersion: null,
      error: null,
      errorMessage: transitionCopy,  // repurpose errorMessage as transition label
    })

    // Last ~200 words as continuation context
    const words = frozenText.trim().split(/\s+/)
    const tail  = words.slice(-200).join(' ')

    const abort = new AbortController()
    abortRef.current = abort

    flushIntervalRef.current = setInterval(() => {
      const currentText = textBufferRef.current
      if (currentText) {
        setState(prev => ({ ...prev, text: currentText, status: 'generating' }))
      }
    }, 50)

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...params,
          explicitness:               newLevel,
          continuation_context_direct: tail,
          previous_explicitness:       prevLevel,
        }),
        signal: abort.signal,
      })

      if (!response.ok) {
        stopFlushInterval()
        let errorCode: YearnErrorCode = 'unknown'
        try {
          const err = await response.json() as { error?: string }
          errorCode = (err.error as YearnErrorCode) ?? 'unknown'
        } catch { /* unparseable */ }
        setState(prev => ({
          ...prev,
          status: 'error',
          error: errorCode,
          errorMessage: getFriendlyError(errorCode),
        }))
        return
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const messages = buffer.split('\n\n')
        buffer = messages.pop() ?? ''

        for (const message of messages) {
          if (!message.trim()) continue
          const lines = message.split('\n')
          let eventType = 'message'
          let dataLine  = ''
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            else if (line.startsWith('data: ')) dataLine = line.slice(6).trim()
          }
          if (!dataLine) continue
          let parsed: unknown
          try { parsed = JSON.parse(dataLine) } catch { continue }

          switch (eventType) {
            case 'token': {
              const { t } = parsed as { t: string }
              textBufferRef.current += t
              break
            }
            case 'done': {
              stopFlushInterval()
              const { word_count, prompt_version } = parsed as { word_count: number; prompt_version: string }
              const finalText = textBufferRef.current
              setState({
                status: 'done',
                text: finalText,
                wordCount: word_count,
                promptVersion: prompt_version,
                error: null,
                errorMessage: null,
              })
              recordImplicitSignal('generation_completed', { word_count }, authToken)
              break
            }
            case 'error': {
              stopFlushInterval()
              const { code } = parsed as { code: YearnErrorCode }
              setState(prev => ({
                ...prev,
                status: 'error',
                text: textBufferRef.current,
                error: code,
                errorMessage: getFriendlyError(code),
              }))
              break
            }
          }
        }
      }
    } catch (err) {
      stopFlushInterval()
      if ((err as Error).name === 'AbortError') return
      setState(prev => ({
        ...prev,
        status: 'error',
        text: textBufferRef.current,
        error: 'network_error',
        errorMessage: getFriendlyError('network_error'),
      }))
    }
  }, [authToken, stopFlushInterval])

  return {
    state,
    generate,
    cancel,
    reset,
    adjustExplicitness,
    midReadGenerate,
  }
}

// ─── Error messages ───────────────────────────────────────────────────────────
// These are shown to the user. Never expose technical details.
// Tone matches the Yearns brand — warm, never clinical.

function getFriendlyError(code: YearnErrorCode): string {
  switch (code) {
    case 'unauthenticated':
      return 'Please sign in to continue.'
    case 'age_verification_required':
      return 'Age verification is required before your first Yearn.'
    case 'free_limit_reached':
      return "You've read all your free Yearns this month. Upgrade to continue."
    case 'rate_limited':
      return 'Take a breath — try again in a little while.'
    case 'content_policy':
    case 'output_policy':
      return 'This one didn\'t quite work. Try adjusting your settings and generating again.'
    case 'stream_error':
      return 'Something interrupted your Yearn. Try again.'
    case 'network_error':
      return 'Check your connection and try again.'
    default:
      return 'Something unexpected happened. Try again.'
  }
}

// ─── Implicit signal recorder ─────────────────────────────────────────────────
// Queues signals to be sent to /api/profile/signal in batches.
// Does not block generation — fire and forget.
// Full implementation in /lib/signal-queue.ts

function recordImplicitSignal(
  event: string,
  data: Record<string, unknown>,
  authToken: string | null,
): void {
  if (!authToken) return // signal loss is acceptable
  fetch('/api/profile/signal', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ event, data, timestamp: Date.now() }),
    keepalive: true,
  }).catch(() => { /* signal loss is acceptable */ })
}
