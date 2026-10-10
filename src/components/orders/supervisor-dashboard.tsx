'use client'

import { useMemo, useState } from 'react'
import { summarizeOrders } from '@/domain/orders'
import { OrderStats, type OrderFilter } from '@/components/orders/order-stats'
import { OrdersTable } from '@/components/orders/orders-table'
import type { OrderListItem } from '@/server/services/orders'

const EMPTY_COPY: Record<OrderFilter, { title: string; hint: string }> = {
  ALL: {
    title: 'No cutting orders yet',
    hint: 'Use “Create order” to open the first cutting order from a recipe.',
  },
  PENDING_VERIFICATION: {
    title: 'No pending orders',
    hint: 'Orders waiting for the verifier appear here.',
  },
  VERIFIED: {
    title: 'No verified orders yet',
    hint: 'Orders the verifier approves appear here.',
  },
  REJECTED: {
    title: 'No rejected orders',
    hint: 'Orders the verifier sends back appear here.',
  },
}

export function SupervisorDashboard({ orders }: { orders: OrderListItem[] }) {
  const [filter, setFilter] = useState<OrderFilter>('ALL')
  const summary = useMemo(() => summarizeOrders(orders), [orders])
  const visible = filter === 'ALL' ? orders : orders.filter((order) => order.status === filter)
  const emptyCopy = EMPTY_COPY[filter]

  return (
    <>
      <OrderStats
        summary={summary}
        active={filter}
        onSelect={(next) => setFilter((prev) => (prev === next ? 'ALL' : next))}
      />
      <OrdersTable orders={visible} emptyTitle={emptyCopy.title} emptyHint={emptyCopy.hint} />
    </>
  )
}