'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'

export default function OnboardingPage() {
  const { user, session, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirect to sign-in if unauthenticated (auth UI built in step 13)
    if (!isLoading && !user) {
      router.replace('/signin')
    }
  }, [user, isLoading, router])

  // Blank hold while session resolves — avoids flash of redirect
  if (isLoading || !session) {
    return <div className="min-h-screen" />
  }

  return <OnboardingFlow authToken={session.access_token} />
}
