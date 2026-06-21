'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface PopulateResult {
  queued:   number
  message?: string
  stories?: { id: string; model: string; level: number }[]
  error?:   string
}

export default function AdminQueuePage() {
  const { session } = useAuth()
  const authToken = session?.access_token ?? null

  const [limit, setLimit]               = useState(50)
  const [promptVersion, setPromptVersion] = useState('')
  const [blindReview, setBlindReview]   = useState(true)
  const [loading, setLoading]           = useState(false)
  const [result, setResult]             = useState<PopulateResult | null>(null)

  async function handlePopulate() {
    if (!authToken || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/trainer/queue', {
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          'Authorization':  `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          limit,
          blind_review:   blindReview,
          ...(promptVersion.trim() && { prompt_version: promptVersion.trim() }),
        }),
      })
      const data = await res.json() as PopulateResult
      setResult(data)
    } catch {
      setResult({ queued: 0, error: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-12">
      <div className="mx-auto max-w-xl space-y-10">

        <div className="space-y-1">
          <h1 className="font-serif text-3xl text-gray-900">Populate review queue</h1>
          <p className="text-gray-400 text-sm">
            Pull recent successful generations into the trainer review queue.
          </p>
        </div>

        <div className="space-y-6">

          {/* Limit */}
          <div className="space-y-1.5">
            <label className="text-gray-500 text-xs tracking-widest uppercase">Stories to pull</label>
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-500"
            />
          </div>

          {/* Prompt version filter */}
          <div className="space-y-1.5">
            <label className="text-gray-500 text-xs tracking-widest uppercase">
              Filter by prompt version <span className="normal-case text-gray-300">(leave blank for all)</span>
            </label>
            <input
              type="text"
              value={promptVersion}
              onChange={e => setPromptVersion(e.target.value)}
              placeholder="e.g. 1.2.0"
              className="w-full border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-gray-500 placeholder:text-gray-300"
            />
          </div>

          {/* Blind review */}
          <div className="flex items-center gap-3">
            <button
              role="checkbox"
              aria-checked={blindReview}
              onClick={() => setBlindReview(b => !b)}
              className={`w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                blindReview ? 'bg-gray-900' : 'bg-gray-200'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 mx-1 ${
                blindReview ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
            <span className="text-sm text-gray-600">Blind review (hide model + version until after submission)</span>
          </div>

          <button
            onClick={handlePopulate}
            disabled={loading}
            className="w-full py-3 bg-gray-900 text-white text-sm tracking-widest uppercase hover:bg-gray-700 transition-colors duration-200 disabled:opacity-40"
          >
            {loading ? 'Populating…' : 'Populate queue'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`border px-4 py-4 space-y-3 ${result.error ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
            {result.error ? (
              <p className="text-red-600 text-sm">{result.error}</p>
            ) : (
              <>
                <p className="text-gray-900 text-sm font-medium">
                  {result.queued === 0
                    ? result.message ?? 'No new stories to queue'
                    : `${result.queued} ${result.queued === 1 ? 'story' : 'stories'} added to queue`}
                </p>
                {result.stories && result.stories.length > 0 && (
                  <div className="space-y-1">
                    {result.stories.map(s => (
                      <div key={s.id} className="text-xs text-gray-400 font-mono">
                        {s.id.slice(0, 8)}… · {s.model} · level {s.level}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-gray-100">
          <a href="/trainer" className="text-gray-400 text-xs tracking-widest uppercase hover:text-gray-600 transition-colors">
            ← Trainer dashboard
          </a>
        </div>

      </div>
    </div>
  )
}
