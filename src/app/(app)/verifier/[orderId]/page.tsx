import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { VerificationTerminal } from '@/components/verification/verification-terminal'
import { requireRolePage } from '@/server/auth/page-guard'
import { db } from '@/server/db'
import { getVerificationContext } from '@/server/services/verification'

export default async function VerificationTerminalPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  await requireRolePage('cutting_verifier')
  const { orderId } = await params
  const context = await getVerificationContext(db, orderId)
  if (!context || context.order.status !== 'PENDING_VERIFICATION') notFound()

  const { order, recipe } = context

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/verifier"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to queue
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">{order.orderNo}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {recipe.name} ({recipe.recipeCode}) · Target {order.targetQty} · Roll{' '}
          {order.fabricRollId}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Submitted by {order.createdByName ?? 'Unknown'} on{' '}
          {order.createdAt.toISOString().slice(0, 10)} · Expected fabric{' '}
          {order.expectedFabricYds.toFixed(2)} yds · Used {order.actualFabricYds.toFixed(2)} yds
        </p>
      </div>

      <VerificationTerminal context={context} />
    </div>
  )
}
