// Served by the service worker when the user is offline and no cached
// version of the requested page is available.
export default function OfflinePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6">
      <div className="text-center space-y-6 animate-fade-up">
        <h1 className="font-serif text-4xl text-gray-900 tracking-tight">
          Yearns
        </h1>
        <p className="font-serif text-gray-900/60 text-lg">
          You appear to be offline.
        </p>
        <p className="text-gray-900/35 text-sm max-w-xs leading-relaxed">
          Connect to the internet and your story will be waiting.
        </p>
      </div>
    </main>
  )
}
