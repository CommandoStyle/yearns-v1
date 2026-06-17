import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-8">
      <div className="text-center space-y-8 animate-fade-up">

        <div className="space-y-3">
          <h1 className="font-serif text-6xl text-yearns-cream tracking-tight">
            Yearns
          </h1>
          <p className="text-yearns-gold text-lg font-light max-w-xs mx-auto leading-relaxed">
            Your intimate erotic fantasies.<br />In words. In context. Anytime.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 pt-2">
          <Link
            href="/signup"
            className="px-10 py-4 border border-yearns-gold/55 text-yearns-gold font-serif text-base tracking-wide hover:bg-yearns-gold/8 transition-all duration-300"
          >
            Begin
          </Link>
          <Link
            href="/signup"
            className="text-yearns-cream/30 text-xs tracking-widest uppercase hover:text-yearns-cream/55 transition-colors duration-200"
          >
            Already have an account? Sign in
          </Link>
        </div>

      </div>
    </main>
  )
}
