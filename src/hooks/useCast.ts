'use client'

import { useState, useCallback } from 'react'
import type { CastCharacterRow } from '@/types/cast'

interface UseCastReturn {
  cast:        CastCharacterRow[]
  selfRow:     CastCharacterRow | null
  loading:     boolean
  error:       string | null
  load:        (token: string) => Promise<void>
  save:        (token: string, data: Partial<CastCharacterRow> & { is_self?: boolean }) => Promise<CastCharacterRow | null>
  update:      (token: string, id: string, data: Partial<CastCharacterRow>) => Promise<CastCharacterRow | null>
  remove:      (token: string, id: string) => Promise<boolean>
}

export function useCast(): UseCastReturn {
  const [cast,    setCast]    = useState<CastCharacterRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const selfRow = cast.find(c => c.is_self) ?? null

  const load = useCallback(async (token: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cast', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('fetch_failed')
      const { cast: rows } = await res.json()
      setCast(rows as CastCharacterRow[])
    } catch {
      setError('Could not load cast.')
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (
    token: string,
    data: Partial<CastCharacterRow> & { is_self?: boolean },
  ): Promise<CastCharacterRow | null> => {
    try {
      const res = await fetch('/api/cast', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(data),
      })
      if (!res.ok) return null
      const { character } = await res.json()
      setCast(prev => {
        const exists = prev.find(c => c.id === character.id)
        if (exists) return prev.map(c => c.id === character.id ? character : c)
        return [...prev, character]
      })
      return character as CastCharacterRow
    } catch {
      return null
    }
  }, [])

  const update = useCallback(async (
    token: string,
    id: string,
    data: Partial<CastCharacterRow>,
  ): Promise<CastCharacterRow | null> => {
    try {
      const res = await fetch(`/api/cast?id=${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(data),
      })
      if (!res.ok) return null
      const { character } = await res.json()
      setCast(prev => prev.map(c => c.id === id ? character : c))
      return character as CastCharacterRow
    } catch {
      return null
    }
  }, [])

  const remove = useCallback(async (token: string, id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/cast?id=${id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return false
      setCast(prev => prev.filter(c => c.id !== id))
      return true
    } catch {
      return false
    }
  }, [])

  return { cast, selfRow, loading, error, load, save, update, remove }
}
