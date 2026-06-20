'use client'

/**
 * /admin/originality
 * Admin review surface for external plagiarism flags.
 * Shows pending_review flags with matched sources and allows triage.
 */

import { useState, useEffect, useCallback } from 'react'

type FlagStatus = 'pending_review' | 'reviewed_ok' | 'reviewed_concern'

interface OriginFlag {
  id:          string
  yearn_id:    string | null
  story_id:    string | null
  result: {
    flagged:         boolean
    similarityScore: number
    matchedSources:  Array<{ url: string; similarity: number }>
    provider:        string
    checkedAt:       string
  }
  status:      FlagStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at:  string
}

const STATUS_TABS: { key: FlagStatus; label: string }[] = [
  { key: 'pending_review',   label: 'Pending'  },
  { key: 'reviewed_ok',      label: 'OK'       },
  { key: 'reviewed_concern', label: 'Concern'  },
]

export default function OriginalityAdminPage() {
  const [status,   setStatus]   = useState<FlagStatus>('pending_review')
  const [flags,    setFlags]    = useState<OriginFlag[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/originality?status=${status}&page=${page}`)
    if (res.ok) {
      const data = await res.json() as { flags: OriginFlag[]; total: number }
      setFlags(data.flags)
      setTotal(data.total)
    }
    setLoading(false)
  }, [status, page])

  useEffect(() => { void load() }, [load])

  async function resolve(id: string, newStatus: 'reviewed_ok' | 'reviewed_concern') {
    setUpdating(id)
    await fetch('/api/admin/originality', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, status: newStatus }),
    })
    await load()
    setUpdating(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">

      <div className="space-y-1">
        <h1 className="font-serif text-3xl text-gray-900">Originality flags</h1>
        <p className="text-gray-900/40 text-sm">
          External plagiarism check results. Flags are advisory — review matched sources before marking.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-6 border-b border-gray-900/10">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setStatus(t.key); setPage(1) }}
            className={`pb-3 text-xs tracking-widest uppercase transition-colors ${
              status === t.key
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-900/30 hover:text-gray-900/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-900/30 text-sm">Loading…</p>
      ) : flags.length === 0 ? (
        <p className="text-gray-900/40 text-sm">No {status.replace(/_/g, ' ')} flags.</p>
      ) : (
        <div className="space-y-4">
          {flags.map(flag => (
            <div key={flag.id} className="border border-gray-900/10 p-5 space-y-4">

              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-gray-900/60 text-xs font-mono">
                    Flag {flag.id.slice(0, 8)}
                    {flag.yearn_id && ` · Yearn ${flag.yearn_id.slice(0, 8)}`}
                    {flag.story_id && ` · Gen ${flag.story_id.slice(0, 8)}`}
                  </p>
                  <p className="text-gray-900/35 text-xs">
                    {new Date(flag.created_at).toLocaleString()}
                    {' · Provider: '}{flag.result.provider}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 border ${
                  flag.result.similarityScore >= 0.4
                    ? 'border-gray-900/30 text-gray-900/60'
                    : 'border-gray-900/15 text-gray-900/35'
                }`}>
                  {Math.round(flag.result.similarityScore * 100)}% similar
                </span>
              </div>

              {/* Matched sources */}
              {flag.result.matchedSources.length > 0 && (
                <div className="space-y-2">
                  <p className="text-gray-900/45 text-xs tracking-widest uppercase">Matched sources</p>
                  <ul className="space-y-1">
                    {flag.result.matchedSources.slice(0, 5).map((src, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-3">
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-900/60 text-sm truncate hover:text-gray-900/90 transition-colors underline underline-offset-2"
                        >
                          {src.url}
                        </a>
                        <span className="text-gray-900/35 text-xs shrink-0">
                          {Math.round(src.similarity * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions (only for pending) */}
              {flag.status === 'pending_review' && (
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => resolve(flag.id, 'reviewed_ok')}
                    disabled={updating === flag.id}
                    className="py-2 px-4 border border-gray-900/20 text-gray-900/50 text-xs hover:bg-gray-900/4 transition-all duration-200 disabled:opacity-40"
                  >
                    {updating === flag.id ? '…' : 'Mark OK'}
                  </button>
                  <button
                    onClick={() => resolve(flag.id, 'reviewed_concern')}
                    disabled={updating === flag.id}
                    className="py-2 px-4 border border-gray-900/20 text-gray-900/50 text-xs hover:bg-gray-900/4 transition-all duration-200 disabled:opacity-40"
                  >
                    {updating === flag.id ? '…' : 'Flag concern'}
                  </button>
                </div>
              )}

              {/* Reviewed state */}
              {flag.status !== 'pending_review' && (
                <p className="text-gray-900/30 text-xs">
                  {flag.status === 'reviewed_ok' ? 'Marked OK' : 'Flagged concern'}
                  {flag.reviewed_at && ` · ${new Date(flag.reviewed_at).toLocaleDateString()}`}
                </p>
              )}

            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 25 && (
        <div className="flex gap-4 items-center justify-center pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-gray-900/30 text-xs hover:text-gray-900/60 disabled:opacity-30 transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-900/30 text-xs">
            Page {page} of {Math.ceil(total / 25)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 25)}
            className="text-gray-900/30 text-xs hover:text-gray-900/60 disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>
      )}

    </div>
  )
}
