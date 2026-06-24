'use client'

import { useState, useCallback } from 'react'

export interface ProfilePatch {
  display_name?:           string
  participant_mode?:       import('@/lib/prompt-engine').ParticipantMode
  hard_limits?:            string[]
  three_words?:            [string, string, string]
  language?:               string
  age_band?:               string
  prose_rhythm?:           string
  last_explicitness_used?: number
  onboarding_complete?:    boolean
}

export interface UseProfileReturn {
  isUpdating: boolean
  update: (patch: ProfilePatch, authToken: string) => Promise<boolean>
}

export function useProfile(): UseProfileReturn {
  const [isUpdating, setIsUpdating] = useState(false)

  const update = useCallback(async (
    patch: ProfilePatch,
    authToken: string,
  ): Promise<boolean> => {
    setIsUpdating(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(patch),
      })
      return res.ok
    } catch {
      return false
    } finally {
      setIsUpdating(false)
    }
  }, [])

  return { isUpdating, update }
}
