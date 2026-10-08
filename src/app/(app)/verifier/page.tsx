export default function VerifierQueuePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Verification Queue</h1>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-600">
          Pending cutting orders awaiting verification will appear here.
        </p>
      </div>
    </div>
  )
}
