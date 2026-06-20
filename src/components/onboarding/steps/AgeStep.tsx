'use client'

import { useState } from 'react'

interface AgeStepProps {
  onNext: (dob: string) => void  // ISO date string YYYY-MM-DD
}

export function AgeStep({ onNext }: AgeStepProps) {
  const [dob,   setDob]   = useState('')
  const [error, setError] = useState('')

  function handleContinue() {
    setError('')
    if (!dob) { setError('Please enter your date of birth.'); return }

    const birth = new Date(dob)
    const now   = new Date()
    let age     = now.getFullYear() - birth.getFullYear()
    const m     = now.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--

    if (isNaN(age) || age < 0 || age > 120) {
      setError('Please enter a valid date of birth.')
      return
    }
    if (age < 18) {
      setError('You must be 18 or older to use Yearns.')
      return
    }

    onNext(dob)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-sm space-y-10 animate-fade-up">

        <div className="space-y-2">
          <h2 className="font-serif text-3xl text-gray-900 tracking-tight">Your age</h2>
          <p className="text-gray-900/45 text-sm leading-relaxed">
            Yearns contains adult content. You must be 18 or older to continue.
          </p>
        </div>

        <div className="space-y-3">
          <label htmlFor="dob" className="block text-gray-900/45 text-xs tracking-widest uppercase">
            Date of birth
          </label>
          <input
            id="dob"
            type="date"
            value={dob}
            onChange={e => setDob(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full bg-transparent border-b border-gray-900/20 text-gray-900 py-2.5 text-sm focus:outline-none focus:border-gray-600/60 transition-colors duration-200"
          />
          {error && (
            <p className="text-gray-900/50 text-sm">{error}</p>
          )}
        </div>

        <button
          onClick={handleContinue}
          disabled={!dob}
          className="w-full py-4 border border-gray-600/50 text-gray-600 font-serif text-base tracking-wide hover:bg-gray-600/8 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>

        <p className="text-gray-900/25 text-xs leading-relaxed text-center">
          This is a temporary age check. Full identity verification will be required before launch.
        </p>

      </div>
    </div>
  )
}
