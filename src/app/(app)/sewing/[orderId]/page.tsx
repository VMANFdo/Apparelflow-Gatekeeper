import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { db } from '@/server/db'
import { getVerifiedOrderDetail } from '@/server/services/sewing'
import { SewingDetailView } from '@/components/sewing/detail-view'

export default async function SewingDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params

  let detail
  try {
    detail = await getVerifiedOrderDetail(db, orderId)
  } catch {
    notFound()
  }

  const { recipe } = detail

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/sewing"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to queue
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">{detail.orderNo}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {recipe.name} ({recipe.recipeCode}) · Target {detail.targetQty} pcs · Roll{' '}
          {detail.fabricRollId}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Verified by {detail.verifierName ?? 'Unknown'} on{' '}
          {new Date(detail.verifiedAt).toISOString().slice(0, 10)}
        </p>
      </div>

      <SewingDetailView detail={detail} />
    </div>
  )
}
