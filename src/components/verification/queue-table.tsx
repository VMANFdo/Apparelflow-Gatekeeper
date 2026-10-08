'use client'

import Link from 'next/link'
import { ArrowRight, ClipboardList } from 'lucide-react'
import type { PendingQueueItem } from '@/server/services/verification'

function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toISOString().slice(0, 10)
}

function openTerminalButton(order: PendingQueueItem) {
  return (
    <Link
      href={`/verifier/${order.id}`}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
    >
      Open terminal
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  )
}

export function VerifierQueueTable({ orders }: { orders: PendingQueueItem[] }) {
  if (orders.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <ClipboardList className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-slate-900">No orders waiting</p>
        <p className="mt-1 text-sm text-slate-600">
          New cutting orders appear here as soon as a supervisor submits them.
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
              <th className="px-4 py-3 font-medium">Roll ID</th>
              <th className="px-4 py-3 font-medium">Submitted by</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {orders.map((order) => (
              <tr key={order.id} className="align-top">
                <td className="px-4 py-3 font-medium text-slate-900">{order.orderNo}</td>
                <td className="px-4 py-3">
                  <span className="block text-slate-900">{order.recipeName}</span>
                  <span className="block text-xs text-slate-500">{order.recipeCode}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">{order.targetQty}</td>
                <td className="px-4 py-3 text-slate-700">{order.fabricRollId}</td>
                <td className="px-4 py-3 text-slate-700">{order.createdByName ?? 'Unknown'}</td>
                <td className="px-4 py-3 text-slate-700">{formatDate(order.createdAt)}</td>
                <td className="px-4 py-3">{openTerminalButton(order)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="mt-8 space-y-3 md:hidden">
        {orders.map((order) => (
          <li
            key={order.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900">{order.orderNo}</span>
              <span className="rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                Pending
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Recipe</dt>
                <dd className="text-slate-900">{order.recipeName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Qty</dt>
                <dd className="text-slate-900">{order.targetQty}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Roll ID</dt>
                <dd className="text-slate-900">{order.fabricRollId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Submitted by</dt>
                <dd className="text-slate-900">{order.createdByName ?? 'Unknown'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Date</dt>
                <dd className="text-slate-900">{formatDate(order.createdAt)}</dd>
              </div>
            </dl>
            <div className="mt-3">{openTerminalButton(order)}</div>
          </li>
        ))}
      </ul>
    </>
  )
}
