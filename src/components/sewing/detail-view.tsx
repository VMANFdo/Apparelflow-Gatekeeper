'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, Scissors, XCircle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import type { SewingQueueDetailItem } from '@/server/services/sewing'

// ─── Variance badge (colour + icon + text — never colour-only per SKILLS.md §10) ─

function VarianceBadge({
  variance,
  status,
}: {
  variance: number | null
  status: 'GREEN' | 'YELLOW' | 'RED' | null
}) {
  if (status === null || variance === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        —
      </span>
    )
  }
  if (status === 'GREEN') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Match
      </span>
    )
  }
  if (status === 'YELLOW') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        +{variance} Surplus
      </span>
    )
  }
  // RED
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800">
      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
      {variance} Shortage
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SewingDetailView({ detail }: { detail: SewingQueueDetailItem }) {
  const router = useRouter()
  const toast = useToast()
  // Initialise from server data so refreshing always reflects reality
  const [started, setStarted] = useState(detail.sewingStartedAt !== null)
  const [loading, setLoading] = useState(false)

  const wastageOver = detail.wastagePct > detail.recipe.wastageCap

  async function handleStart() {
    if (started || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/sewing/${detail.id}/start`, { method: 'POST' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast(body?.error?.message ?? 'Could not start sewing', 'error')
        return
      }
      setStarted(true)
      toast('Sewing assembly started', 'success')
      router.refresh()
    } catch {
      toast('Could not reach the server. Check your connection.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* ── Verification summary card ──────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Verification summary</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Verifier</dt>
            <dd className="mt-0.5 text-slate-900">{detail.verifierName ?? 'Unknown'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Verified on</dt>
            <dd className="mt-0.5 text-slate-900">
              {new Date(detail.verifiedAt).toISOString().slice(0, 10)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Fabric used</dt>
            <dd className="mt-0.5 text-slate-900">{detail.actualFabricYds.toFixed(2)} yds</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Expected fabric</dt>
            <dd className="mt-0.5 text-slate-900">{detail.expectedFabricYds.toFixed(2)} yds</dd>
          </div>
        </dl>

        {/* Fabric wastage — warning badge if over cap, but NEVER blocks start */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-slate-500">Fabric wastage:</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              wastageOver
                ? 'border-amber-300 bg-amber-100 text-amber-800'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800'
            }`}
          >
            {wastageOver && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
            {detail.wastagePct.toFixed(2)}%
            {wastageOver
              ? ` — exceeds ${detail.recipe.wastageCap}% cap`
              : ` — within ${detail.recipe.wastageCap}% cap`}
          </span>
        </div>

        {detail.approvalNote && (
          <div className="mt-4">
            <p className="text-xs text-slate-500">Approval note</p>
            <p className="mt-0.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
              {detail.approvalNote}
            </p>
          </div>
        )}
      </div>

      {/* ── Component piece counts ─────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Component piece counts</h2>

        {/* Desktop: table */}
        <div className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Component</th>
                <th className="px-4 py-3 font-medium">Expected</th>
                <th className="px-4 py-3 font-medium">Actual</th>
                <th className="px-4 py-3 font-medium">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {detail.items.map((item) => (
                <tr key={item.componentId} className="align-top">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.componentName}</td>
                  <td className="px-4 py-3 text-slate-700">{item.expectedQty}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {item.actualQty !== null ? item.actualQty : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <VarianceBadge variance={item.variance} status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <ul className="mt-3 space-y-3 md:hidden">
          {detail.items.map((item) => (
            <li
              key={item.componentId}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{item.componentName}</p>
                <VarianceBadge variance={item.variance} status={item.status} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Expected</dt>
                  <dd className="text-slate-900">{item.expectedQty}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Actual</dt>
                  <dd className="text-slate-900">
                    {item.actualQty !== null ? item.actualQty : '—'}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Start Sewing Assembly button ───────────────────────────── */}
      <div className="flex items-center gap-4">
        {started ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Sewing assembly started
            {detail.sewingStartedByName && (
              <span className="ml-1 text-emerald-800">by {detail.sewingStartedByName}</span>
            )}
          </div>
        ) : (
          <button
            id="start-sewing-btn"
            type="button"
            onClick={() => void handleStart()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Starting…
              </>
            ) : (
              <>
                <Scissors className="h-4 w-4" aria-hidden="true" />
                Start Sewing Assembly
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
