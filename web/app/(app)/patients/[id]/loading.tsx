export default function Loading() {
  return (
    <div className="min-h-screen bg-app text-app">
      <main className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">

          {/* Left column */}
          <div className="space-y-4">
            <div className="bg-surface border border-app rounded-xl p-6">
              <div className="w-16 h-16 rounded-full bg-surface3 mx-auto mb-3" />
              <div className="h-5 bg-surface3 rounded w-3/4 mx-auto mb-2" />
              <div className="h-4 bg-surface3 rounded w-1/2 mx-auto mb-1" />
              <div className="h-4 bg-surface3 rounded w-2/3 mx-auto" />
            </div>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-surface border border-app rounded-xl h-11" />
            ))}
          </div>

          {/* Right column */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app">
                <div className="h-5 bg-surface3 rounded w-32" />
              </div>
              <div className="p-4 space-y-3">
                <div className="h-3 bg-surface3 rounded w-full" />
                <div className="h-3 bg-surface3 rounded w-5/6" />
                <div className="h-3 bg-surface3 rounded w-4/6" />
              </div>
            </div>
            <div className="bg-surface border border-app rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-app">
                <div className="h-5 bg-surface3 rounded w-40" />
              </div>
              <div className="p-4 space-y-3">
                <div className="h-16 bg-surface3 rounded-xl" />
                <div className="h-16 bg-surface3 rounded-xl" />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
