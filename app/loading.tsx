/* ─── Shown by Next.js App Router while page.tsx awaits Supabase data ───────────
   This guards the DARK marketing landing ('/'), so it must be a DARK skeleton — a
   white one flashes white→black before the page paints. <html> is already #000 in
   the dark zone (see lib/zones.ts), so the shimmer blocks are translucent white. */
export default function Loading() {
  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Nav skeleton */}
      <header className="fixed top-0 inset-x-0 z-50 bg-black border-b border-white/10 h-16" />

      <div className="pt-16">

        {/* Hero skeleton — 88vh split */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] border-b border-white/10"
             style={{ minHeight: '88vh' }}>

          {/* Image panel */}
          <div className="bg-white/[0.03] animate-pulse" style={{ minHeight: '65vw', maxHeight: '92vh' }} />

          {/* Detail panel */}
          <div className="flex flex-col px-10 md:px-16 py-16 lg:py-20 border-l border-white/10 gap-6">
            <div className="h-2 w-32 bg-white/[0.06] rounded animate-pulse" />
            <div className="space-y-3 mt-4">
              <div className="h-14 w-3/4 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-14 w-1/2 bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="h-2 w-20 bg-white/[0.06] rounded animate-pulse mt-2" />
            <div className="space-y-2 mt-4">
              <div className="h-2 w-full bg-white/[0.06] rounded animate-pulse" />
              <div className="h-2 w-5/6 bg-white/[0.06] rounded animate-pulse" />
              <div className="h-2 w-4/6 bg-white/[0.06] rounded animate-pulse" />
            </div>
            <div className="flex-1" />
            <div className="space-y-3">
              <div className="h-px w-full bg-white/10" />
              {[1, 2, 3].map(i => (
                <div key={i} className="flex justify-between py-3 border-b border-white/10">
                  <div className="h-2 w-20 bg-white/[0.06] rounded animate-pulse" />
                  <div className="h-2 w-24 bg-white/[0.06] rounded animate-pulse" />
                </div>
              ))}
              <div className="h-12 w-full bg-white/[0.06] rounded animate-pulse mt-4" />
            </div>
          </div>
        </div>

        {/* Grid skeleton */}
        <div className="max-w-screen-xl mx-auto px-8 md:px-14 pt-20 pb-32">
          <div className="h-2 w-40 bg-white/[0.06] rounded animate-pulse mb-4" />
          <div className="h-8 w-56 bg-white/[0.06] rounded animate-pulse mb-14" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i}>
                <div className="aspect-[2/3] bg-white/[0.03] animate-pulse mb-4" />
                <div className="h-2 w-16 bg-white/[0.06] rounded animate-pulse mb-2" />
                <div className="h-3 w-36 bg-white/[0.06] rounded animate-pulse mb-1" />
                <div className="h-2 w-24 bg-white/[0.06] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
