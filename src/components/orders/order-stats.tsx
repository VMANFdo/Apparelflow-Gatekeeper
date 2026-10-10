'use client'

import { CheckCircle2, ClipboardList, Clock3, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { OrderStatus } from '@/db/schema'
import type { OrderSummary } from '@/domain/orders'

export type OrderFilter = 'ALL' | OrderStatus

type CardConfig = {
  key: OrderFilter
  label: string
  getValue: (summary: OrderSummary) => number
  icon: LucideIcon
  iconClass: string
  numberClass: string
  activeClass: string
}

const CARDS: CardConfig[] = [
  {
    key: 'ALL',
    label: 'Total orders',
    getValue: (summary) => summary.total,
    icon: ClipboardList,
    iconClass: 'text-slate-700',
    numberClass: 'text-slate-900',
    activeClass: 'border-slate-600 ring-2 ring-slate-200',
  },
  {
    key: 'PENDING_VERIFICATION',
    label: 'Pending verification',
    getValue: (summary) => summary.pending,
    icon: Clock3,
    iconClass: 'text-amber-700',
    numberClass: 'text-amber-900',
    activeClass: 'border-amber-700 ring-2 ring-amber-300',
  },
  {
    key: 'VERIFIED',
    label: 'Verified',
    getValue: (summary) => summary.verified,
    icon: CheckCircle2,
    iconClass: 'text-emerald-700',
    numberClass: 'text-emerald-900',
    activeClass: 'border-emerald-600 ring-2 ring-emerald-300',
  },
  {
    key: 'REJECTED',
    label: 'Rejected',
    getValue: (summary) => summary.rejected,
    icon: XCircle,
    iconClass: 'text-red-700',
    numberClass: 'text-red-900',
    activeClass: 'border-red-600 ring-2 ring-red-300',
  },
]

type OrderStatsProps = {
  summary: OrderSummary
  active: OrderFilter
  onSelect: (filter: OrderFilter) => void
}

export function OrderStats({ summary, active, onSelect }: OrderStatsProps) {
  return (
    <div
      role="group"
      aria-label="Order summary"
      className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4"
    >
      {CARDS.map((card) => {
        const Icon = card.icon
        const isActive = active === card.key
        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(card.key)}
            className={`rounded-xl border bg-white p-5 text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              isActive ? card.activeClass : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Icon className={`h-5 w-5 ${card.iconClass}`} aria-hidden="true" />
            <p className={`mt-3 text-3xl font-semibold tabular-nums ${card.numberClass}`}>
              {card.getValue(summary)}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
          </button>
        )
      })}
    </div>
  )
}