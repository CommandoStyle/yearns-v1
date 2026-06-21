'use client'

import { useState, useCallback } from 'react'

export interface ProfilePatch {
  display_name?:         string
  genre_weights?:        Record<string, number>
  emotional_register?:   string[]
  desire_targets?:       string
  explicitness_default?: number
  participant_mode?:     import('@/lib/prompt-engine').ParticipantMode
  hard_limits?:          string[]
  three_words?:          [string, string, string]
  style_references?:     string[]
  setting_preference?:   Record<string, number>
  language?:             string
  onboarding_complete?:  boolean
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
