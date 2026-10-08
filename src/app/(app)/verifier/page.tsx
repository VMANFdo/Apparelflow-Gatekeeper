import { VerifierQueueTable } from '@/components/verification/queue-table'
import { requireRolePage } from '@/server/auth/page-guard'
import { db } from '@/server/db'
import { listPendingQueue } from '@/server/services/verification'

export default async function VerifierQueuePage() {
  await requireRolePage('cutting_verifier')
  const orders = await listPendingQueue(db)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Verification Queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Count and verify the pieces on each cutting order.
        </p>
      </div>

      <VerifierQueueTable orders={orders} />
    </div>
  )
}
