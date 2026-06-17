import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-8">
      <div className="text-center space-y-8 animate-fade-up">

        <div className="space-y-3">
          <h1 className="font-serif text-6xl text-gray-900 tracking-tight">
            Yearns
          </h1>
          <p className="text-gray-600 text-lg font-light max-w-xs mx-auto leading-relaxed">
            Your intimate erotic fantasies.<br />In words. In context. Anytime.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 pt-2">
          <Link
            href="/signup"
            className="px-10 py-4 border border-gray-600/55 text-gray-600 font-serif text-base tracking-wide hover:bg-gray-600/8 transition-all duration-300"
          >
            Begin
          </Link>
          <Link
            href="/signup"
            className="text-gray-900/30 text-xs tracking-widest uppercase hover:text-gray-900/55 transition-colors duration-200"
          >
            Already have an account? Sign in
          </Link>
        </div>

      </div>
    </main>
  )
}
