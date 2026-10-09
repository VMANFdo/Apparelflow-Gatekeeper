import { db } from '@/server/db'
import { listVerifiedQueue } from '@/server/services/sewing'
import { SewingQueueCards } from '@/components/sewing/queue-cards'

export default async function SewingQueuePage() {
  const orders = await listVerifiedQueue(db)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sewing Queue</h1>
        <p className="mt-1 text-sm text-slate-600">
          Verified cutting orders ready for sewing assembly.
        </p>
      </div>

      <SewingQueueCards orders={orders} />
    </div>
  )
}
