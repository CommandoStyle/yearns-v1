'use client'

// /profile/build — deliberate profile-building page.
// Shows all progressive profile questions at once so a user who skips
// post-Yearn prompts can complete her profile deliberately.
// Linked from Settings → "Build your profile".

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

const SECTIONS = [
  {
    heading: 'Your limits',
    sub: "Hard limits are absolute — they're never overridden.",
    href: '/settings',
    linkLabel: 'Set in Settings →',
  },
  {
    heading: 'Your mood',
    sub: 'When and how you read shapes the stories we write.',
    questions: [
      {
        id: 'reading_mood',
        q:  'When do you tend to read Yearns?',
        options: ['Wind-down before sleep', 'Stolen moment mid-day', 'Whenever the mood hits'],
      },
    ],
  },
  {
    heading: 'Your life',
    sub: 'Context that makes stories resonate more closely.',
    questions: [
      {
        id: 'relationship_context',
        q:  'What\'s your relationship situation right now?',
        options: ['Single', 'In a relationship', 'It\'s complicated', 'Prefer not to say'],
      },
    ],
  },
  {
    heading: 'Your perspective',
    sub: 'How you like to experience a story.',
    questions: [
      {
        id: 'pov_preference',
        q:  'Do you prefer being the protagonist, or watching from outside?',
        options: ['I\'m in the story', 'I\'m watching', 'Depends on my mood'],
      },
    ],
  },
  {
    heading: 'Your cast',
    sub: 'Build recurring characters who appear across your Yearns.',
    href: '/profile/cast',
    linkLabel: 'Manage your cast →',
  },
  {
    heading: 'About you',
    sub: 'Optional physical details that can appear in stories.',
    href: '/profile/cast',
    linkLabel: 'Edit your self-description →',
  },
]

export default function BuildProfilePage() {
  const router     = useRouter()
  const { session } = useAuth()
  const authToken  = session?.access_token ?? null
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saved,   setSaved]   = useState<Record<string, boolean>>({})

  function handleAnswer(questionId: string, answer: string) {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
    if (authToken) {
      fetch('/api/profile/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          event: 'profile_question_answered',
          data: { question_id: questionId, answer },
          timestamp: Date.now(),
        }),
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
          <h1 className="font-serif text-2xl text-gray-900 tracking-tight">Build your profile</h1>
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

        {SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className="space-y-4 pt-6 border-t border-gray-900/8">
            <div>
              <h2 className="text-gray-900/70 text-sm font-medium">{section.heading}</h2>
              <p className="text-gray-400 text-xs mt-0.5">{section.sub}</p>
            </div>

            {section.href && (
              <a
                href={section.href}
                className="text-gray-900/40 text-xs tracking-widest uppercase hover:text-gray-900/65 transition-colors"
              >
                {section.linkLabel}
              </a>
            )}

            {section.questions?.map(q => (
              <div key={q.id} className="space-y-2">
                <p className="text-gray-700 text-sm">{q.q}</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleAnswer(q.id, opt)}
                      className={`px-3 py-1.5 text-xs border rounded-sm transition-colors duration-200 ${
                        answers[q.id] === opt
                          ? 'border-gray-900 text-gray-900 bg-gray-50'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400'
                      }`}
                    >{opt}</button>
                  ))}
                </div>
                {saved[q.id] && <p className="text-gray-300 text-xs">Saved</p>}
              </div>
            ))}
          </div>
        ))}

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
