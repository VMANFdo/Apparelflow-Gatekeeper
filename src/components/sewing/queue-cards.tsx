'use client'

import Link from 'next/link'
import { ArrowRight, Shirt } from 'lucide-react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { SewingQueueItem } from '@/server/services/sewing'

function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toISOString().slice(0, 10)
}

function StatusBadge({ started }: { started: boolean }) {
  if (started) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Sewing started
      </span>
    )
  }
  return (
    <span className="rounded-full border border-teal-300 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
      Awaiting sewing
    </span>
  )
}

function WastageBadge({ pct, cap }: { pct: number; cap: number }) {
  const over = pct > cap
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        over
          ? 'border-amber-300 bg-amber-100 text-amber-800'
          : 'border-slate-200 bg-slate-100 text-slate-700'
      }`}
    >
      {over && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
      {pct.toFixed(2)}%{over ? ` — exceeds ${cap}% cap` : ''}
    </span>
  )
}

export function SewingQueueCards({ orders }: { orders: SewingQueueItem[] }) {
  if (orders.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Shirt className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-slate-900">No verified batches</p>
        <p className="mt-1 text-sm text-slate-600">
          Approved cutting orders will appear here once a verifier approves them.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop: table */}
      <div className="mt-8 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Recipe</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Verifier</th>
              <th className="px-4 py-3 font-medium">Verified</th>
              <th className="px-4 py-3 font-medium">Wastage</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {orders.map((order) => (
              <tr key={order.id} className="align-top">
                <td className="px-4 py-3 font-medium text-slate-900">{order.orderNo}</td>
                <td className="px-4 py-3">
                  <span className="block text-slate-900">{order.recipe.name}</span>
                  <span className="block text-xs text-slate-500">{order.recipe.recipeCode}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">{order.targetQty}</td>
                <td className="px-4 py-3 text-slate-700">{order.verifierName ?? 'Unknown'}</td>
                <td className="px-4 py-3 text-slate-700">{formatDate(order.verifiedAt)}</td>
                <td className="px-4 py-3">
                  <WastageBadge pct={order.wastagePct} cap={order.recipe.wastageCap} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge started={order.sewingStartedAt !== null} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/sewing/${order.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  >
                    View detail
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="mt-8 space-y-3 md:hidden">
        {orders.map((order) => (
          <li key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900">{order.orderNo}</span>
              <StatusBadge started={order.sewingStartedAt !== null} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Recipe</dt>
                <dd className="text-slate-900">{order.recipe.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Qty</dt>
                <dd className="text-slate-900">{order.targetQty}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Verifier</dt>
                <dd className="text-slate-900">{order.verifierName ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Verified</dt>
                <dd className="text-slate-900">{formatDate(order.verifiedAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Wastage</dt>
                <dd className="mt-0.5">
                  <WastageBadge pct={order.wastagePct} cap={order.recipe.wastageCap} />
                </dd>
              </div>
            </dl>
            <div className="mt-3">
              <Link
                href={`/sewing/${order.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                View detail
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
