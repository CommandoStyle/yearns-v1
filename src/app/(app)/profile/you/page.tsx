'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCast } from '@/hooks/useCast'
import { SelfDescriptionFlow } from '@/components/cast/SelfDescriptionFlow'

export default function YouPage() {
  const router                             = useRouter()
  const { session }                        = useAuth()
  const authToken                          = session?.access_token ?? null
  const { selfRow, loading, load }         = useCast()

  useEffect(() => {
    if (authToken) load(authToken)
  }, [authToken, load])

  return (
    <div className="min-h-screen px-6 py-16">
      <div className="max-w-sm mx-auto space-y-10">

        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl text-gray-900 tracking-tight">You</h1>
          <button
            onClick={() => router.back()}
            className="text-gray-900/30 text-xs tracking-widest uppercase hover:text-gray-900/60 transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-400 text-sm leading-relaxed -mt-8">
          Optional physical details that can appear in your Yearns. Entirely yours to share or skip.
        </p>

        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : (
          <SelfDescriptionFlow
            initial={selfRow ?? {}}
            authToken={authToken}
            onSaved={() => router.back()}
          />
        )}

      </div>
    </div>
  )
}
