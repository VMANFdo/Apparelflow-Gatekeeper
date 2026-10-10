'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ClipboardList, Clock3, Loader2, RotateCcw, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OrderStatus } from '@/db/schema'
import {
  ORDER_STATUS_BADGE_CLASSES,
  ORDER_STATUS_LABELS,
} from '@/domain/orders'
import { useToast } from '@/components/ui/toast'
import type { OrderListItem } from '@/server/services/orders'

const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  PENDING_VERIFICATION: Clock3,
  REJECTED: XCircle,
  VERIFIED: CheckCircle2,
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const Icon = STATUS_ICONS[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE_CLASSES[status]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {ORDER_STATUS_LABELS[status]}
    </span>
  )
}

function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toISOString().slice(0, 10)
}

export function OrdersTable({
  orders,
  emptyTitle = 'No cutting orders yet',
  emptyHint = 'Use “Create order” to open the first cutting order from a recipe.',
}: {
  orders: OrderListItem[]
  emptyTitle?: string
  emptyHint?: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function resubmit(order: OrderListItem) {
    setBusyId(order.id)
    try {
      const res = await fetch(`/api/orders/${order.id}/resubmit`, { method: 'POST' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast(body?.error?.message ?? 'Could not resubmit the order', 'error')
        return
      }
      toast(`Order ${body.order.orderNo} resubmitted for verification`, 'success')
      router.refresh()
    } catch {
      toast('Could not reach the server. Check your connection and try again.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  function resubmitButton(order: OrderListItem) {
    return (
      <button
        type="button"
        disabled={busyId === order.id}
        onClick={() => void resubmit(order)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {busyId === order.id ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Resubmit
      </button>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <ClipboardList className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-slate-900">{emptyTitle}</p>
        <p className="mt-1 text-sm text-slate-600">{emptyHint}</p>
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
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
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
                <td className="px-4 py-3 text-slate-700">{order.fabricRollId}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDate(order.createdAt)}</td>
                <td className="px-4 py-3">
                  {order.status === 'REJECTED' ? (
                    <div className="space-y-2">
                      <p className="max-w-[16rem] text-xs text-red-800">
                        {order.rejectionNote ?? 'Rejected by the verifier.'}
                      </p>
                      {resubmitButton(order)}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
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
              <StatusBadge status={order.status} />
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
                <dt className="text-xs text-slate-500">Roll ID</dt>
                <dd className="text-slate-900">{order.fabricRollId}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Created</dt>
                <dd className="text-slate-900">{formatDate(order.createdAt)}</dd>
              </div>
            </dl>
            {order.status === 'REJECTED' && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-900">
                  {order.rejectionNote ?? 'Rejected by the verifier.'}
                </p>
                <div className="mt-2">{resubmitButton(order)}</div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
