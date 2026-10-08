export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div
        role="status"
        aria-label="Loading"
        className="h-9 w-9 animate-pulse rounded-lg bg-slate-300"
      />
    </div>
  )
}
