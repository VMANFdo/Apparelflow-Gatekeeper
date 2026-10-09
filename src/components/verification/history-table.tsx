import { CheckCircle2, History, XCircle } from 'lucide-react'
import type {
  RejectedHistoryItem,
  VerifierHistory as VerifierHistoryData,
  VerifiedHistoryItem,
} from '@/server/services/verification'

function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toISOString().slice(0, 10)
}

function SectionHeading({
  title,
  count,
  description,
}: {
  title: string
  count: number
  description: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-600">{description}</p>
      </div>
      <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
        {count} {count === 1 ? 'order' : 'orders'}
      </span>
    </div>
  )
}

function EmptySection({ title, message }: { title: string; message: string }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <History className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
    </div>
  )
}

function VerifiedSection({ orders }: { orders: VerifiedHistoryItem[] }) {
  return (
    <section className="mt-8" aria-label="Verified orders">
      <SectionHeading
        title="Verified orders"
        count={orders.length}
        description="Approved by the verifier and cleared for sewing."
      />

      {orders.length === 0 ? (
        <EmptySection title="No verified orders yet" message="Approved orders will be listed here." />
      ) : (
        <>
          <div className="mt-3 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Recipe</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Verifier</th>
                  <th className="px-4 py-3 font-medium">Verified</th>
                  <th className="px-4 py-3 font-medium">Wastage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((order) => (
                  <tr key={order.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-medium text-slate-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                        {order.orderNo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-slate-900">{order.recipeName}</span>
                      <span className="block text-xs text-slate-500">{order.recipeCode}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.targetQty}</td>
                    <td className="px-4 py-3 text-slate-700">{order.verifierName ?? 'Unknown'}</td>
                    <td className="px-4 py-3 text-slate-700" title={order.decisionAt.toISOString()}>
                      {formatDate(order.decisionAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.wastagePct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-3 space-y-3 md:hidden">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    {order.orderNo}
                  </span>
                  <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
                    Verified
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
                    <dt className="text-xs text-slate-500">Verifier</dt>
                    <dd className="text-slate-900">{order.verifierName ?? 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Verified</dt>
                    <dd className="text-slate-900">{formatDate(order.decisionAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Wastage</dt>
                    <dd className="text-slate-900">{order.wastagePct.toFixed(2)}%</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function RejectedSection({ orders }: { orders: RejectedHistoryItem[] }) {
  return (
    <section className="mt-10" aria-label="Rejected orders">
      <SectionHeading
        title="Rejected orders"
        count={orders.length}
        description="Sent back to the supervisor with a reason."
      />

      {orders.length === 0 ? (
        <EmptySection title="No rejected orders yet" message="Rejected orders will be listed here." />
      ) : (
        <>
          <div className="mt-3 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Recipe</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Attempt</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {orders.map((order) => (
                  <tr key={order.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 font-medium text-slate-900">
                        <XCircle className="h-4 w-4 text-red-700" aria-hidden="true" />
                        {order.orderNo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-slate-900">{order.recipeName}</span>
                      <span className="block text-xs text-slate-500">{order.recipeCode}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.targetQty}</td>
                    <td className="px-4 py-3 text-slate-700">#{order.attemptNo}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <span className="block max-w-[20rem] text-red-900" title={order.rejectionNote ?? undefined}>
                        {order.rejectionNote ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700" title={order.decisionAt.toISOString()}>
                      {formatDate(order.decisionAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-3 space-y-3 md:hidden">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                    <XCircle className="h-4 w-4 text-red-700" aria-hidden="true" />
                    {order.orderNo}
                  </span>
                  <span className="rounded-full border border-red-300 bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-900">
                    Rejected
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
                    <dt className="text-xs text-slate-500">Attempt</dt>
                    <dd className="text-slate-900">#{order.attemptNo}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Rejected</dt>
                    <dd className="text-slate-900">{formatDate(order.decisionAt)}</dd>
                  </div>
                </dl>
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-xs text-red-900">{order.rejectionNote ?? 'No reason recorded.'}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function VerifierHistory({ history }: { history: VerifierHistoryData }) {
  return (
    <div className="mt-12 border-t border-slate-200 pt-8">
      <VerifiedSection orders={history.verified} />
      <RejectedSection orders={history.rejected} />
    </div>
  )
}
