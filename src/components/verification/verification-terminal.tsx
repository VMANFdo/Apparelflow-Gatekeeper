'use client'

import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Save,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  canApprove,
  evaluateComponent,
  listBlockingItems,
  VERDICT_BADGE_CLASSES,
  VERDICT_LABELS,
  type ComponentVerdict,
  type CountEntry,
} from '@/domain/verification'
import { useToast } from '@/components/ui/toast'
import { ApproveBar } from '@/components/verification/approve-bar'
import type { VerificationContext } from '@/server/services/verification'

const BLOCKED_INT_KEYS = new Set(['e', 'E', '+', '-', '.', ' '])

const VERDICT_ICONS: Record<ComponentVerdict, LucideIcon> = {
  GREEN: CheckCircle2,
  YELLOW: AlertTriangle,
  RED: XCircle,
  UNCOUNTED: ClipboardCheck,
}

type RowState = {
  raw: string
  error: string | null
}

function parseCount(raw: string): { value: number | null; error: string | null } {
  if (raw.trim() === '') return { value: null, error: null }
  if (!/^\d+$/.test(raw)) {
    return { value: null, error: 'Enter a whole number (digits only)' }
  }
  const value = Number(raw)
  if (value > 1000000) {
    return { value: null, error: 'Count must be 1,000,000 or less' }
  }
  return { value, error: null }
}

function initialRows(items: VerificationContext['items']): Record<string, RowState> {
  const rows: Record<string, RowState> = {}
  for (const item of items) {
    rows[item.component_id] = {
      raw: item.actual_qty === null ? '' : String(item.actual_qty),
      error: null,
    }
  }
  return rows
}

export function VerificationTerminal({ context }: { context: VerificationContext }) {
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<Record<string, RowState>>(() => initialRows(context.items))
  const [countsSaved, setCountsSaved] = useState(() =>
    context.items.some((item) => item.actual_qty !== null)
  )
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const parsed = useMemo(() => {
    const map: Record<string, { value: number | null; error: string | null }> = {}
    for (const item of context.items) {
      map[item.component_id] = parseCount(rows[item.component_id]?.raw ?? '')
    }
    return map
  }, [context.items, rows])

  const summary = useMemo(() => {
    const counts = { GREEN: 0, YELLOW: 0, RED: 0, UNCOUNTED: 0 }
    for (const item of context.items) {
      const verdict = evaluateComponent(item.expected_qty, parsed[item.component_id]?.value ?? null)
      counts[verdict] += 1
    }
    return counts
  }, [context.items, parsed])

  const hasErrors = context.items.some((item) => parsed[item.component_id]?.error !== null)
  const localItems = context.items.map((item) => ({
    componentId: item.component_id,
    componentName: item.component_name,
    expectedQty: item.expected_qty,
    actualQty: parsed[item.component_id]?.value ?? null,
  }))

  const pendingCounts = useMemo<CountEntry[]>(
    () =>
      context.items.map((item) => {
        const value = parsed[item.component_id]?.value ?? null
        return { component_id: item.component_id, actual_qty: value }
      }),
    [context.items, parsed]
  )

  const canApproveNow = canApprove(localItems)
  const blocking = listBlockingItems(localItems)
  const blockedSummary =
    blocking.length === 0
      ? ''
      : (() => {
          const shortages = blocking.filter((b) => b.verdict === 'RED').length
          const uncounted = blocking.filter((b) => b.verdict === 'UNCOUNTED').length
          const parts: string[] = []
          if (shortages > 0) parts.push(`${shortages} shortage${shortages > 1 ? 's' : ''}`)
          if (uncounted > 0) {
            parts.push(`${uncounted} component${uncounted > 1 ? 's' : ''} not counted`)
          }
          return parts.join(' and ')
        })()

  function handleChange(componentId: string, event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value
    setServerError(null)
    setCountsSaved(false)
    setRows((prev) => {
      const { error } = parseCount(raw)
      return { ...prev, [componentId]: { raw, error } }
    })
  }

  function blockKeys(event: KeyboardEvent<HTMLInputElement>) {
    if (BLOCKED_INT_KEYS.has(event.key)) event.preventDefault()
  }

  async function saveCounts() {
    if (hasErrors || saving) return
    setSaving(true)
    setServerError(null)

    try {
      const res = await fetch(`/api/verification/${context.order.id}/counts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts: pendingCounts }),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok) {
        const message = body?.error?.message ?? 'Could not save the counts'
        const details: string[] = body?.error?.details ?? []
        setServerError(details.length > 0 ? `${message}: ${details.join('; ')}` : message)
        toast(message, 'error')
        return
      }

      const saved: Record<string, RowState> = {}
      for (const item of body.items as { component_id: string; actual_qty: number | null }[]) {
        saved[item.component_id] = {
          raw: item.actual_qty === null ? '' : String(item.actual_qty),
          error: null,
        }
      }
      setRows(saved)
      setCountsSaved(true)
      toast('Counts saved', 'success')
      router.refresh()
    } catch {
      const message = 'Could not reach the server. Check your connection and try again.'
      setServerError(message)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-3" role="status" aria-label="Verification summary">
        <SummaryPill verdict="GREEN" count={summary.GREEN} />
        <SummaryPill verdict="YELLOW" count={summary.YELLOW} />
        <SummaryPill verdict="RED" count={summary.RED} />
        <SummaryPill verdict="UNCOUNTED" count={summary.UNCOUNTED} />
      </div>

      {serverError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          {serverError}
        </p>
      )}

      {/* Desktop: table */}
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Component</th>
              <th className="px-4 py-3 font-medium">Expected</th>
              <th className="px-4 py-3 font-medium">Actual count</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {context.items.map((item) => {
              const row = rows[item.component_id]
              const { value, error } = parsed[item.component_id]
              const verdict = evaluateComponent(item.expected_qty, value)
              const delta = value === null ? null : value - item.expected_qty
              return (
                <tr key={item.component_id} className="align-top">
                  <td className="px-4 py-3 font-medium text-slate-900">{item.component_name}</td>
                  <td className="px-4 py-3 text-slate-700">{item.expected_qty}</td>
                  <td className="px-4 py-3">
                    <input
                      id={`count-${item.component_id}-desktop`}
                      inputMode="numeric"
                      autoComplete="off"
                      value={row?.raw ?? ''}
                      onChange={(e) => handleChange(item.component_id, e)}
                      onKeyDown={blockKeys}
                      aria-label={`Actual count for ${item.component_name}`}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `count-${item.component_id}-desktop-error` : undefined}
                      placeholder="—"
                      className="w-28"
                    />
                    {error && (
                      <p
                        id={`count-${item.component_id}-desktop-error`}
                        role="alert"
                        className="mt-1 text-xs text-red-700"
                      >
                        {error}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <VerdictBadge verdict={verdict} delta={delta} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="mt-4 space-y-3 md:hidden">
        {context.items.map((item) => {
          const row = rows[item.component_id]
          const { value, error } = parsed[item.component_id]
          const verdict = evaluateComponent(item.expected_qty, value)
          const delta = value === null ? null : value - item.expected_qty
          return (
            <li key={item.component_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.component_name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Expected {item.expected_qty}</p>
                </div>
                <VerdictBadge verdict={verdict} delta={delta} />
              </div>
              <div className="mt-3">
                <label
                  htmlFor={`count-${item.component_id}`}
                  className="block text-xs font-medium text-slate-700"
                >
                  Actual count
                </label>
                <input
                  id={`count-${item.component_id}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={row?.raw ?? ''}
                  onChange={(e) => handleChange(item.component_id, e)}
                  onKeyDown={blockKeys}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `count-${item.component_id}-error` : undefined}
                  placeholder="—"
                  className="mt-1 w-full"
                />
                {error && (
                  <p
                    id={`count-${item.component_id}-error`}
                    role="alert"
                    className="mt-1 text-xs text-red-700"
                  >
                    {error}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Save bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {hasErrors
            ? 'Fix the highlighted fields before saving.'
            : 'Counts are also checked on the server.'}
        </p>
        <button
          type="button"
          onClick={() => void saveCounts()}
          disabled={hasErrors || allEmpty || saving}
          title={
            hasErrors
              ? 'Fix the highlighted fields to enable this button'
              : undefined
          }
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-500"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden="true" />
              Save counts
            </>
          )}
        </button>
      </div>

      <ApproveBar
        orderId={context.order.id}
        canApproveNow={canApproveNow}
        blockedSummary={blockedSummary}
        countsSaved={countsSaved}
      />
    </div>
  )
}

function VerdictBadge({ verdict, delta }: { verdict: ComponentVerdict; delta: number | null }) {
  const Icon = VERDICT_ICONS[verdict]
  const label =
    verdict === 'GREEN'
      ? VERDICT_LABELS.GREEN
      : verdict === 'YELLOW'
        ? `+${delta} ${VERDICT_LABELS.YELLOW}`
        : verdict === 'RED'
          ? `${delta} ${VERDICT_LABELS.RED}`
          : VERDICT_LABELS.UNCOUNTED
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${VERDICT_BADGE_CLASSES[verdict]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}

function SummaryPill({ verdict, count }: { verdict: ComponentVerdict; count: number }) {
  const Icon = VERDICT_ICONS[verdict]
  const text =
    verdict === 'GREEN'
      ? `${count} match`
      : verdict === 'YELLOW'
        ? `${count} surplus`
        : verdict === 'RED'
          ? `${count} shortage`
          : `${count} not counted`
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${VERDICT_BADGE_CLASSES[verdict]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {text}
    </span>
  )
}
