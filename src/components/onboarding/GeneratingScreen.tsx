'use client'

import { useEffect, useState } from 'react'

const LINES = [
  'Learning your desires…',
  'Shaping your world…',
  'Setting the scene…',
  'Almost ready…',
]

export function GeneratingScreen() {
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setLineIndex(i => (i + 1) % LINES.length)
    }, 1400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-10">
      {/* Pulsing orb */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-yearns-gold/20 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-yearns-gold/40" />
        <div className="absolute inset-4 rounded-full bg-yearns-gold/70" />
      </div>

      <p
        key={lineIndex}
        className="font-serif text-xl text-yearns-cream/70 animate-fade-in text-center"
      >
        {LINES[lineIndex]}
      </p>
    </div>
  )
}
