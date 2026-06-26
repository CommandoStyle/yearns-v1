'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createBrowserClient } from '@/lib/supabase'
import type { AgeBand } from '@/lib/age-registers'

const AGE_BANDS: { key: AgeBand; label: string }[] = [
  { key: '18_24',   label: '18–24'  },
  { key: '25_34',   label: '25–34'  },
  { key: '35_44',   label: '35–44'  },
  { key: '45_54',   label: '45–54'  },
  { key: '55_64',   label: '55–64'  },
  { key: '65_plus', label: '65+'    },
]

const QUESTIONS = [
  {
    section: 'Your mood',
    sub:     'When and how you read shapes the stories we write.',
    id:      'reading_mood',
    q:       'When do you tend to read Yearns?',
    options: ['Wind-down before sleep', 'Stolen moment mid-day', 'Whenever the mood hits'],
  },
  {
    section: 'Your life',
    sub:     'Context that makes stories resonate more closely.',
    id:      'relationship_context',
    q:       "What's your relationship situation right now?",
    options: ['Single', 'In a relationship', "It's complicated", 'Prefer not to say'],
  },
  {
    section: 'Your perspective',
    sub:     'How you like to experience a story.',
    id:      'pov_preference',
    q:       'Do you prefer being the protagonist, or watching from outside?',
    options: ["I'm in the story", "I'm watching", 'Depends on my mood'],
  },
]

export default function BuildProfilePage() {
  const router      = useRouter()
  const { session } = useAuth()
  const authToken   = session?.access_token ?? null

  const [answers,  setAnswers]  = useState<Record<string, string>>({})
  const [saved,    setSaved]    = useState<Record<string, boolean>>({})
  const [ageBand,  setAgeBand]  = useState<AgeBand | null>(null)
  const [ageStage, setAgeStage] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  useEffect(() => {
    async function loadAgeBand() {
      const supabase = createBrowserClient()
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!s) return
      const { data } = await supabase
        .from('desire_profiles')
        .select('age_band')
        .eq('user_id', s.user.id)
        .single()
      const row = data as { age_band?: string } | null
      if (row?.age_band) setAgeBand(row.age_band as AgeBand)
    }
    loadAgeBand()
  }, [])

  async function saveAgeBand(band: AgeBand) {
    setAgeBand(band)
    setAgeStage('saving')
    try {
      const supabase = createBrowserClient()
      const { data: { session: s } } = await supabase.auth.getSession()
      if (!s) { setAgeStage('error'); return }
      const res = await fetch('/api/profile', {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${s.access_token}`,
        },
        body: JSON.stringify({ age_band: band }),
      })
      setAgeStage(res.ok ? 'done' : 'error')
    } catch {
      setAgeStage('error')
    }
  }

  function handleAnswer(questionId: string, answer: string) {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    if (authToken) {
      fetch('/api/profile/signal', {
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body:     JSON.stringify({ event: 'profile_question_answered', data: { question_id: questionId, answer }, timestamp: Date.now() }),
        keepalive: true,
      }).catch(() => {})
    }
    setSaved(prev => ({ ...prev, [questionId]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [questionId]: false })), 1200)
  }

  return (
    <div className="min-h-screen px-6 py-16">
      <div className="max-w-sm mx-auto space-y-12">

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
          The more you share, the better your stories fit. All optional — answer anything, skip everything.
        </p>

        {/* Profile questions */}
        {QUESTIONS.map(({ section, sub, id, q, options }) => (
          <div key={id} className="space-y-4 pt-6 border-t border-gray-900/8">
            <div>
              <h2 className="text-gray-900/70 text-sm font-medium">{section}</h2>
              <p className="text-gray-400 text-xs mt-0.5">{sub}</p>
            </div>
            <div className="space-y-2">
              <p className="text-gray-700 text-sm">{q}</p>
              <div className="flex flex-wrap gap-2">
                {options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(id, opt)}
                    className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                      answers[id] === opt
                        ? 'border-gray-900 text-gray-900 bg-gray-50'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >{opt}</button>
                ))}
              </div>
              {saved[id] && <p className="text-gray-300 text-xs">Saved</p>}
            </div>
          </div>
        ))}

        {/* Age */}
        <div className="space-y-4 pt-6 border-t border-gray-900/8">
          <div>
            <h2 className="text-gray-900/70 text-sm font-medium">Age</h2>
            <p className="text-gray-400 text-xs mt-0.5">Helps shape the tone and perspective of your Yearns.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {AGE_BANDS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => saveAgeBand(key)}
                className={`py-2.5 px-3 text-center border transition-all duration-200 ${
                  ageBand === key
                    ? 'border-gray-600/70 bg-gray-600/5'
                    : 'border-gray-900/12 hover:border-gray-900/25'
                }`}
              >
                <p className={`font-serif text-sm ${ageBand === key ? 'text-gray-600' : 'text-gray-900'}`}>{label}</p>
              </button>
            ))}
          </div>
          {ageStage === 'done'  && <p className="text-gray-300 text-xs">Saved</p>}
          {ageStage === 'error' && <p className="text-gray-900/45 text-sm">Could not save. Try again.</p>}
        </div>

        {/* About you */}
        <div className="space-y-3 pt-6 border-t border-gray-900/8">
          <div>
            <h2 className="text-gray-900/70 text-sm font-medium">About you</h2>
            <p className="text-gray-400 text-xs mt-0.5">Optional physical details that can appear in your Yearns.</p>
          </div>
          <a
            href="/profile/you"
            className="text-gray-900/40 text-xs tracking-widest uppercase hover:text-gray-900/65 transition-colors"
          >
            Edit →
          </a>
        </div>

        {/* Your limits — last, as it's a negative/boundary option */}
        <div className="space-y-3 pt-6 border-t border-gray-900/8">
          <div>
            <h2 className="text-gray-900/70 text-sm font-medium">Your limits</h2>
            <p className="text-gray-400 text-xs mt-0.5">Hard limits are absolute — never overridden.</p>
          </div>
          <a
            href="/settings"
            className="text-gray-900/40 text-xs tracking-widest uppercase hover:text-gray-900/65 transition-colors"
          >
            Set in Settings →
          </a>
        </div>

        <div className="pt-6 pb-4">
          <button
            onClick={() => router.back()}
            className="text-gray-300 text-xs tracking-widest uppercase hover:text-gray-500 transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  )
}
