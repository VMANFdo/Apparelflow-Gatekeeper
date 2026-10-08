export default function AppLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white md:block"
      >
        <div className="h-14 border-b border-slate-200" />
        <div className="space-y-3 p-3">
          <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-10 w-4/5 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </aside>

      <div className="md:pl-64">
        <header aria-hidden="true" className="sticky top-0 h-14 border-b border-slate-200 bg-white" />
        <main>
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200" />
                <div className="h-4 w-72 animate-pulse rounded bg-slate-200" />
              </div>
              <div className="h-10 w-36 animate-pulse rounded-lg bg-slate-200" />
            </div>
            <div className="mt-8 space-y-3">
              <div className="h-14 animate-pulse rounded-xl bg-white shadow-sm" />
              <div className="h-14 animate-pulse rounded-xl bg-white shadow-sm" />
              <div className="h-14 animate-pulse rounded-xl bg-white shadow-sm" />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
