/* ─── Shown by Next.js App Router while page.tsx awaits Supabase data ───────── */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav skeleton */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100 h-16" />

      <div className="pt-16">

        {/* Hero skeleton — 88vh split */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] border-b border-zinc-100"
             style={{ minHeight: '88vh' }}>

          {/* Image panel */}
          <div className="bg-zinc-50 animate-pulse" style={{ minHeight: '65vw', maxHeight: '92vh' }} />

          {/* Detail panel */}
          <div className="flex flex-col px-10 md:px-16 py-16 lg:py-20 border-l border-zinc-100 gap-6">
            <div className="h-2 w-32 bg-zinc-100 rounded animate-pulse" />
            <div className="space-y-3 mt-4">
              <div className="h-14 w-3/4 bg-zinc-100 rounded animate-pulse" />
              <div className="h-14 w-1/2 bg-zinc-100 rounded animate-pulse" />
            </div>
            <div className="h-2 w-20 bg-zinc-100 rounded animate-pulse mt-2" />
            <div className="space-y-2 mt-4">
              <div className="h-2 w-full bg-zinc-100 rounded animate-pulse" />
              <div className="h-2 w-5/6 bg-zinc-100 rounded animate-pulse" />
              <div className="h-2 w-4/6 bg-zinc-100 rounded animate-pulse" />
            </div>
            <div className="flex-1" />
            <div className="space-y-3">
              <div className="h-px w-full bg-zinc-100" />
              {[1, 2, 3].map(i => (
                <div key={i} className="flex justify-between py-3 border-b border-zinc-100">
                  <div className="h-2 w-20 bg-zinc-100 rounded animate-pulse" />
                  <div className="h-2 w-24 bg-zinc-100 rounded animate-pulse" />
                </div>
              ))}
              <div className="h-12 w-full bg-zinc-100 rounded animate-pulse mt-4" />
            </div>
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="max-w-screen-xl mx-auto px-8 md:px-14 pt-20 pb-32">
          <div className="h-2 w-40 bg-zinc-100 rounded animate-pulse mb-4" />
          <div className="h-8 w-56 bg-zinc-100 rounded animate-pulse mb-14" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i}>
                <div className="aspect-[2/3] bg-zinc-50 animate-pulse mb-4" />
                <div className="h-2 w-16 bg-zinc-100 rounded animate-pulse mb-2" />
                <div className="h-3 w-36 bg-zinc-100 rounded animate-pulse mb-1" />
                <div className="h-2 w-24 bg-zinc-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
