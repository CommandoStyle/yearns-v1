'use client'

import { useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase'

export interface AuthState {
  user:      User    | null
  session:   Session | null
  isLoading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user:      null,
    session:   null,
    isLoading: true,
  })

  useEffect(() => {
    const supabase = createBrowserClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, isLoading: false })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState({ user: session?.user ?? null, session, isLoading: false })
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  return state
}
