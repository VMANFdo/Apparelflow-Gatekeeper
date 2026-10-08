import { eq } from 'drizzle-orm'
import { cuttingOrders, verificationItems, type OrderStatus } from '@/db/schema'
import { ConflictError, NotFoundError, ValidationError } from '@/domain/errors'
import {
  evaluateComponent,
  toDbStatus,
  type SaveCountsInput,
} from '@/domain/verification'
import type { Db } from '@/server/db'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbLike = Db | Tx

export interface VerificationItemState {
  component_id: string
  component_name: string
  expected_qty: number
  actual_qty: number | null
  status: 'GREEN' | 'YELLOW' | 'RED' | null
}

export interface VerificationItemRow {
  id: string
  componentId: string
  expectedQty: number
  actualQty: number | null
  status: 'GREEN' | 'YELLOW' | 'RED' | null
  componentName: string
}

export function toItemState(item: VerificationItemRow): VerificationItemState {
  return {
    component_id: item.componentId,
    component_name: item.componentName,
    expected_qty: item.expectedQty,
    actual_qty: item.actualQty,
    status: item.status,
  }
}

export async function loadItems(db: DbLike, orderId: string): Promise<VerificationItemRow[]> {
  const rows = await db.query.verificationItems.findMany({
    where: eq(verificationItems.orderId, orderId),
    with: { component: { columns: { componentName: true } } },
  })

  return rows
    .map((row) => ({
      id: row.id,
      componentId: row.componentId,
      expectedQty: row.expectedQty,
      actualQty: row.actualQty,
      status: row.status,
      componentName: row.component.componentName,
    }))
    .sort((a, b) => a.componentName.localeCompare(b.componentName))
}

export async function lockOrder(db: DbLike, orderId: string) {
  const [order] = await db
    .select()
    .from(cuttingOrders)
    .where(eq(cuttingOrders.id, orderId))
    .for('update')
  if (!order) throw new NotFoundError('Order not found')
  return order
}

export function assertPending(order: { status: OrderStatus }): void {
  if (order.status !== 'PENDING_VERIFICATION') {
    throw new ConflictError(
      `Order is ${order.status}, only pending orders can be verified`
    )
  }
}

export async function saveCounts(db: Db, orderId: string, input: SaveCountsInput) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    assertPending(order)

    const items = await loadItems(tx, orderId)
    const byId = new Map(items.map((item) => [item.componentId, item]))

    const unknownIds = input.counts
      .filter((entry) => !byId.has(entry.component_id))
      .map((entry) => entry.component_id)
    if (unknownIds.length > 0) {
      throw new ValidationError(
        'Some component ids do not belong to this order',
        unknownIds.map((id) => `component_id: ${id}`)
      )
    }

    for (const entry of input.counts) {
      const item = byId.get(entry.component_id)
      if (!item) continue
      const status = toDbStatus(evaluateComponent(item.expectedQty, entry.actual_qty))
      await tx
        .update(verificationItems)
        .set({ actualQty: entry.actual_qty, status })
        .where(eq(verificationItems.id, item.id))
      item.actualQty = entry.actual_qty
      item.status = status
    }

    return { items: items.map(toItemState) }
  })
}
