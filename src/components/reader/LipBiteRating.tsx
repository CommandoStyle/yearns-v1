'use client'

// Post-Yearn rating screen — shown once a story completes.
// Bundles the rating moment with one optional progressive profile question.
// The profile question is secondary; rating is primary.

import { useState } from 'react'

// ─── Progressive profile questions ────────────────────────────────────────────
// Priority order per prompt-12 spec:
// hard limits → likes → curious-about → kinks → relationship status →
// reading style → cast → self-profile

interface ProfileQuestion {
  id:          string
  question:    string
  options:     string[]
  profileKey?: string   // desire_profiles column to write to, if applicable
}

const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    id:          'hard_limits_intro',
    question:    'Is there anything you&apos;d never want in a story?',
    options:     ['I&apos;ll set that in Settings', 'No hard limits for me', 'Skip'],
  },
  {
    id:          'reading_mood',
    question:    'When do you tend to read Yearns?',
    options:     ['Wind-down before sleep', 'Stolen moment mid-day', 'Whenever the mood hits', 'Skip'],
  },
  {
    id:          'relationship_context',
    question:    'What&apos;s your relationship situation right now?',
    options:     ['Single', 'In a relationship', 'It&apos;s complicated', 'Prefer not to say', 'Skip'],
  },
  {
    id:          'pov_preference',
    question:    'Do you prefer stories where you&apos;re the protagonist, or watching from outside?',
    options:     ['I&apos;m in the story', 'I&apos;m watching', 'Depends on my mood', 'Skip'],
  },
  {
    id:          'cast_intro',
    question:    'Would you like stories to feature the same people across multiple Yearns?',
    options:     ['Yes — build my cast', 'No — fresh faces each time', 'Skip'],
  },
]

function getQuestionForSession(sessionCount: number): ProfileQuestion {
  const idx = sessionCount % PROFILE_QUESTIONS.length
  return PROFILE_QUESTIONS[idx]
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LipBiteRatingProps {
  authToken:    string | null
  sessionCount: number
  outfit?:      string
  onDismiss:    () => void
}

const RATING_LABELS = ['', '✦', '✦✦', '✦✦✦', '✦✦✦✦']

export function LipBiteRating({ authToken, sessionCount, outfit, onDismiss }: LipBiteRatingProps) {
  const [rating, setRating]             = useState<number | null>(null)
  const [submitted, setSubmitted]       = useState(false)
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const [outfitSaved, setOutfitSaved]   = useState(false)

  function handleSaveOutfit() {
    if (!authToken || !outfit) return
    fetch('/api/wardrobe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ description: outfit }),
      keepalive: true,
    }).then(r => { if (r.ok) setOutfitSaved(true) }).catch(() => {})
  }

  const question = getQuestionForSession(sessionCount)

  function handleRating(r: number) {
    setRating(r)
    if (!authToken) return
    fetch('/api/profile/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ event: 'story_rated', data: { rating: r }, timestamp: Date.now() }),
      keepalive: true,
    }).catch(() => {})
  }

  function handleProfileAnswer(answer: string) {
    if (answer === 'Skip') { onDismiss(); return }
    if (authToken) {
      fetch('/api/profile/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({
          event: 'profile_question_answered',
          data: { question_id: question.id, answer },
          timestamp: Date.now(),
        }),
        keepalive: true,
      }).catch(() => {})
    }
    setSubmitted(true)
    setTimeout(onDismiss, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onDismiss} />

      <div className="relative w-full max-w-lg bg-white border-t border-gray-200 rounded-t-2xl animate-fade-up">
        <div className="px-6 pt-5 pb-10 space-y-8">

          {/* Handle */}
          <div className="flex justify-center -mt-1">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>

          {/* Rating — primary */}
          <div className="space-y-4 text-center">
            <p className="font-serif text-xl text-gray-900 tracking-tight">
              How was that?
            </p>
            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4].map(r => (
                <button
                  key={r}
                  onClick={() => handleRating(r)}
                  onMouseEnter={() => setHoveredRating(r)}
                  onMouseLeave={() => setHoveredRating(null)}
                  className={`text-lg transition-all duration-200 ${
                    (rating !== null ? r <= rating : hoveredRating !== null && r <= hoveredRating)
                      ? 'text-gray-900 scale-110'
                      : 'text-gray-300 hover:text-gray-500'
                  }`}
                >
                  {RATING_LABELS[r]}
                </button>
              ))}
            </div>
            {rating !== null && (
              <p className="text-gray-400 text-xs">
                {rating === 4 ? 'Perfect' : rating === 3 ? 'Lovely' : rating === 2 ? 'Good' : 'Not quite'}
              </p>
            )}
          </div>

          {/* Profile question — secondary, only shown after rating */}
          {rating !== null && !submitted && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <p
                className="text-gray-500 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: question.question }}
              />
              <div className="space-y-2">
                {question.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => handleProfileAnswer(opt)}
                    className={`w-full text-left px-4 py-2.5 text-sm border rounded-sm transition-colors duration-200 ${
                      opt === 'Skip'
                        ? 'border-transparent text-gray-300 hover:text-gray-500 text-xs'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
                    }`}
                    dangerouslySetInnerHTML={{ __html: opt }}
                  />
                ))}
              </div>
            </div>
          )}

          {submitted && (
            <p className="text-center text-gray-400 text-sm">Thank you</p>
          )}

          {/* Save outfit prompt — shown after rating, only if outfit was set */}
          {rating !== null && outfit && !outfitSaved && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-gray-500 text-sm">Save this outfit for next time?</p>
              <button
                onClick={handleSaveOutfit}
                className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 hover:border-gray-400 transition-colors"
              >
                Save
              </button>
            </div>
          )}
          {outfitSaved && (
            <p className="text-gray-400 text-xs text-right">Saved</p>
          )}

          {/* Dismiss if no rating yet */}
          {rating === null && (
            <button
              onClick={onDismiss}
              className="w-full text-gray-300 text-xs tracking-widest uppercase hover:text-gray-500 transition-colors duration-200"
            >
              Skip
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
