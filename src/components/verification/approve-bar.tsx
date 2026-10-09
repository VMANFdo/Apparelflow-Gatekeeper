'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Loader2, ShieldCheck } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { RejectDialog } from '@/components/verification/reject-dialog'
import type { CountEntry } from '@/domain/verification'

type ApproveBarProps = {
  orderId: string
  canApproveNow: boolean
  blockedSummary: string
  counts: CountEntry[]
}

export function ApproveBar({ orderId, canApproveNow, blockedSummary, counts }: ApproveBarProps) {
  const router = useRouter()
  const toast = useToast()
  const [approving, setApproving] = useState(false)
  const [decisionError, setDecisionError] = useState<{ message: string; details: string[] } | null>(
    null
  )
  const [rejectOpen, setRejectOpen] = useState(false)

  async function approve() {
    setApproving(true)
    setDecisionError(null)
    try {
      const res = await fetch(`/api/verification/${orderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts }),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok) {
        const message = body?.error?.message ?? 'Could not approve the order'
        const details: string[] = body?.error?.details ?? []
        setDecisionError({ message, details })
        toast(message, 'error')
        if (res.status === 409) {
          router.push('/verifier')
          router.refresh()
        }
        return
      }

      toast(`Order ${body.order.orderNo} approved`, 'success')
      router.push('/verifier')
      router.refresh()
    } catch {
      const message = 'Could not reach the server. Check your connection and try again.'
      setDecisionError({ message, details: [] })
      toast(message, 'error')
    } finally {
      setApproving(false)
    }
  }

  function handleRejected() {
    setRejectOpen(false)
    toast('Batch rejected. The supervisor has been notified.', 'success')
    router.push('/verifier')
    router.refresh()
  }

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <h2 className="text-sm font-semibold text-slate-900">Decision</h2>
      <p className="mt-1 text-xs text-slate-500">
        Approve only when every row is green or yellow. Approving saves the counts you entered, so
        you can skip Save counts. Rejected orders go back to the supervisor with your reason.
      </p>

      {decisionError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          <p className="font-medium">{decisionError.message}</p>
          {decisionError.details.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {decisionError.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void approve()}
          disabled={!canApproveNow || approving}
          title={canApproveNow ? undefined : `Approval blocked: ${blockedSummary}`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {approving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Approving…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Approve Batch
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setRejectOpen(true)}
          disabled={approving}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <Ban className="h-4 w-4" aria-hidden="true" />
          Reject Batch
        </button>

        {!canApproveNow && (
          <p className="text-xs font-medium text-amber-800" role="status">
            Approval blocked: {blockedSummary}
          </p>
        )}
      </div>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        orderId={orderId}
        counts={counts}
        onRejected={handleRejected}
      />
    </div>
  )
}
