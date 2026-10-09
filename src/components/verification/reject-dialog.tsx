'use client'

import { useState, type FormEvent } from 'react'
import { Loader2, XCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { rejectOrderSchema, type CountEntry } from '@/domain/verification'

type RejectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  counts: CountEntry[]
  onRejected: () => void
}

export function RejectDialog({ open, onOpenChange, orderId, counts, onRejected }: RejectDialogProps) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const trimmed = reason.trim()
  const isValid = rejectOrderSchema.safeParse({ note: trimmed }).success
  const inlineError =
    attempted && trimmed.length < 5
      ? 'Give a reason of at least 5 characters so the supervisor knows what to fix.'
      : null

  function reset() {
    setReason('')
    setAttempted(false)
    setServerError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    setServerError(null)
    if (!isValid) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/verification/${orderId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: trimmed, counts }),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok) {
        const message = body?.error?.message ?? 'Could not reject the order'
        setServerError(message)
        toast(message, 'error')
        if (res.status === 409) onRejected()
        return
      }

      reset()
      onRejected()
    } catch {
      const message = 'Could not reach the server. Check your connection and try again.'
      setServerError(message)
      toast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent>
        <DialogTitle>Reject batch</DialogTitle>
        <DialogDescription>
          Explain what is wrong with this batch. The supervisor will see your reason and can
          resubmit the order.
        </DialogDescription>

        <form onSubmit={handleSubmit} noValidate className="mt-5">
          {serverError && (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
            >
              {serverError}
            </p>
          )}

          <label htmlFor="reject-reason" className="block text-sm font-medium text-slate-900">
            Reason for rejection
          </label>
          <textarea
            id="reject-reason"
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setServerError(null)
            }}
            onBlur={() => setAttempted(true)}
            aria-invalid={inlineError ? true : undefined}
            aria-describedby={inlineError ? 'reject-reason-error' : undefined}
            placeholder="e.g. Hem Elastic Casing is short by 4 pieces — recut and re-count"
            className="mt-1 w-full rounded-lg px-3 py-2 text-sm"
          />
          <div className="mt-1 flex items-start justify-between gap-3">
            {inlineError ? (
              <p id="reject-reason-error" role="alert" className="text-sm text-red-700">
                {inlineError}
              </p>
            ) : (
              <span />
            )}
            <span className="shrink-0 text-xs text-slate-500">{trimmed.length}/500</span>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-900 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Rejecting…
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Reject batch
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
