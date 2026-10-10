import { asc, count, desc, eq, inArray } from 'drizzle-orm'
import { cuttingOrders, verificationItems, verificationLogs, type OrderStatus } from '@/db/schema'
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/domain/errors'
import { computeWastagePct } from '@/domain/wastage'
import { assertTransition } from '@/domain/stateMachine'
import { isUuid } from '@/domain/validation'
import {
  buildVarianceSnapshot,
  canApprove,
  evaluateComponent,
  listBlockingItems,
  toDbStatus,
  type ApproveOrderInput,
  type RejectOrderInput,
  type SaveCountsInput,
} from '@/domain/verification'
import type { SessionUser } from '@/server/auth/session'
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

export async function applyCounts(
  tx: Tx,
  orderId: string,
  counts: { component_id: string; actual_qty: number | null }[]
): Promise<VerificationItemRow[]> {
  const items = await loadItems(tx, orderId)
  const byId = new Map(items.map((item) => [item.componentId, item]))

  const unknownIds = counts
    .filter((entry) => !byId.has(entry.component_id))
    .map((entry) => entry.component_id)
  if (unknownIds.length > 0) {
    throw new ValidationError(
      'Some component ids do not belong to this order',
      unknownIds.map((id) => `component_id: ${id}`)
    )
  }

  for (const entry of counts) {
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

  return items
}

export async function saveCounts(db: Db, orderId: string, input: SaveCountsInput) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    assertPending(order)

    const items = await applyCounts(tx, orderId, input.counts)

    return { items: items.map(toItemState) }
  })
}

async function nextAttemptNo(db: DbLike, orderId: string): Promise<number> {
  const logs = await db
    .select({ id: verificationLogs.id })
    .from(verificationLogs)
    .where(eq(verificationLogs.orderId, orderId))
  return logs.length + 1
}

export function blockingDetails(items: VerificationItemRow[]): string[] {
  const byComponentId = new Map(items.map((item) => [item.componentId, item]))
  return listBlockingItems(items).map((blocking) => {
    const item = blocking.componentId ? byComponentId.get(blocking.componentId) : undefined
    const expected = item ? item.expectedQty : '?'
    const actual = item && item.actualQty !== null ? String(item.actualQty) : 'not counted'
    const name = blocking.componentName ?? 'Unknown component'
    return `${name}: ${blocking.verdict} (expected ${expected}, actual ${actual})`
  })
}

export function assertVerifier(actor: SessionUser): void {
  if (actor.role !== 'cutting_verifier') {
    throw new ForbiddenError('Only cutting verifiers can approve or reject orders')
  }
}

export async function approveOrder(
  db: Db,
  actor: SessionUser,
  orderId: string,
  input: ApproveOrderInput
) {
  assertVerifier(actor)
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    assertTransition(order.status, 'VERIFIED')

    const items = await loadItems(tx, orderId)
    if (!canApprove(items)) {
      throw new BusinessRuleError(
        'Order cannot be approved while components are RED or uncounted',
        blockingDetails(items)
      )
    }

    const wastagePct = computeWastagePct(
      Number(order.expectedFabricYds),
      Number(order.actualFabricYds)
    )
    const snapshot = buildVarianceSnapshot(items, wastagePct)
    const attemptNo = await nextAttemptNo(tx, orderId)
    const approvalNote = input.approval_note?.trim() ? input.approval_note.trim() : null

    const [log] = await tx
      .insert(verificationLogs)
      .values({
        orderId: order.id,
        verifierId: actor.id,
        decision: 'APPROVED',
        rejectionNote: null,
        approvalNote,
        wastagePct: wastagePct.toFixed(2),
        varianceSnapshot: snapshot,
        attemptNo,
        createdAt: new Date(),
      })
      .returning({ id: verificationLogs.id })
    if (!log) throw new Error('Failed to insert verification log')

    const [updated] = await tx
      .update(cuttingOrders)
      .set({ status: 'VERIFIED', updatedAt: new Date() })
      .where(eq(cuttingOrders.id, order.id))
      .returning()
    if (!updated) throw new Error('Failed to update order')

    return {
      order: { id: updated.id, orderNo: updated.orderNo, status: updated.status },
      wastagePct,
      attemptNo,
      approvalNote,
      logId: log.id,
    }
  })
}

export async function rejectOrder(
  db: Db,
  actor: SessionUser,
  orderId: string,
  input: RejectOrderInput
) {
  assertVerifier(actor)
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId)
    assertTransition(order.status, 'REJECTED')

    const items = await loadItems(tx, orderId)
    const wastagePct = computeWastagePct(
      Number(order.expectedFabricYds),
      Number(order.actualFabricYds)
    )
    const snapshot = buildVarianceSnapshot(items, wastagePct)
    const attemptNo = await nextAttemptNo(tx, orderId)
    const note = input.note.trim()

    const [log] = await tx
      .insert(verificationLogs)
      .values({
        orderId: order.id,
        verifierId: actor.id,
        decision: 'REJECTED',
        rejectionNote: note,
        approvalNote: null,
        wastagePct: wastagePct.toFixed(2),
        varianceSnapshot: snapshot,
        attemptNo,
        createdAt: new Date(),
      })
      .returning({ id: verificationLogs.id })
    if (!log) throw new Error('Failed to insert verification log')

    const [updated] = await tx
      .update(cuttingOrders)
      .set({ status: 'REJECTED', updatedAt: new Date() })
      .where(eq(cuttingOrders.id, order.id))
      .returning()
    if (!updated) throw new Error('Failed to update order')

    return {
      order: { id: updated.id, orderNo: updated.orderNo, status: updated.status },
      wastagePct,
      attemptNo,
      rejectionNote: note,
      logId: log.id,
    }
  })
}

export interface PendingQueueItem {
  id: string
  orderNo: string
  targetQty: number
  fabricRollId: string
  createdAt: Date
  createdByName: string | null
  recipeName: string
  recipeCode: string
}

export async function listPendingQueue(db: Db): Promise<PendingQueueItem[]> {
  const orders = await db.query.cuttingOrders.findMany({
    where: eq(cuttingOrders.status, 'PENDING_VERIFICATION'),
    orderBy: [asc(cuttingOrders.createdAt), asc(cuttingOrders.orderNo)],
    columns: {
      id: true,
      orderNo: true,
      targetQty: true,
      fabricRollId: true,
      createdAt: true,
    },
    with: {
      recipe: { columns: { name: true, recipeCode: true } },
      createdByUser: { columns: { fullName: true } },
    },
  })

  return orders.map((order) => ({
    id: order.id,
    orderNo: order.orderNo,
    targetQty: order.targetQty,
    fabricRollId: order.fabricRollId,
    createdAt: order.createdAt,
    createdByName: order.createdByUser?.fullName ?? null,
    recipeName: order.recipe.name,
    recipeCode: order.recipe.recipeCode,
  }))
}

export async function countPendingOrders(db: Db): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(cuttingOrders)
    .where(eq(cuttingOrders.status, 'PENDING_VERIFICATION'))
  return row?.value ?? 0
}

export interface VerifiedHistoryItem {
  id: string
  orderNo: string
  targetQty: number
  recipeName: string
  recipeCode: string
  decisionAt: Date
  verifierName: string | null
  wastagePct: number
  approvalNote: string | null
}

export interface RejectedHistoryItem {
  id: string
  orderNo: string
  targetQty: number
  recipeName: string
  recipeCode: string
  decisionAt: Date
  verifierName: string | null
  rejectionNote: string | null
  attemptNo: number
}

export interface VerifierHistory {
  verified: VerifiedHistoryItem[]
  rejected: RejectedHistoryItem[]
}

export async function listVerifierHistory(db: Db, limit = 20): Promise<VerifierHistory> {
  const orders = await db.query.cuttingOrders.findMany({
    where: inArray(cuttingOrders.status, ['VERIFIED', 'REJECTED']),
    orderBy: [desc(cuttingOrders.createdAt)],
    columns: { id: true, orderNo: true, status: true, targetQty: true },
    with: {
      recipe: { columns: { name: true, recipeCode: true } },
      logs: {
        orderBy: [desc(verificationLogs.createdAt)],
        columns: {
          decision: true,
          rejectionNote: true,
          approvalNote: true,
          wastagePct: true,
          attemptNo: true,
          createdAt: true,
        },
        with: {
          verifier: { columns: { fullName: true } },
        },
      },
    },
  })

  const verified: VerifiedHistoryItem[] = []
  const rejected: RejectedHistoryItem[] = []

  for (const order of orders) {
    const base = {
      id: order.id,
      orderNo: order.orderNo,
      targetQty: order.targetQty,
      recipeName: order.recipe.name,
      recipeCode: order.recipe.recipeCode,
    }

    if (order.status === 'VERIFIED') {
      const log = order.logs.find((entry) => entry.decision === 'APPROVED')
      if (!log) continue
      verified.push({
        ...base,
        decisionAt: log.createdAt,
        verifierName: log.verifier?.fullName ?? null,
        wastagePct: Number(log.wastagePct),
        approvalNote: log.approvalNote,
      })
    } else {
      const log = order.logs.find((entry) => entry.decision === 'REJECTED')
      if (!log) continue
      rejected.push({
        ...base,
        decisionAt: log.createdAt,
        verifierName: log.verifier?.fullName ?? null,
        rejectionNote: log.rejectionNote,
        attemptNo: log.attemptNo,
      })
    }
  }

  return {
    verified: verified.slice(0, limit),
    rejected: rejected.slice(0, limit),
  }
}

export interface VerificationContext {
  order: {
    id: string
    orderNo: string
    status: OrderStatus
    targetQty: number
    fabricRollId: string
    actualFabricYds: number
    expectedFabricYds: number
    createdAt: Date
    createdByName: string | null
  }
  recipe: {
    id: string
    recipeCode: string
    name: string
    stdFabricYards: number
    wastageCap: number
  }
  items: VerificationItemState[]
}

export async function getVerificationContext(
  db: Db,
  orderId: string
): Promise<VerificationContext | null> {
  if (!isUuid(orderId)) return null

  const order = await db.query.cuttingOrders.findFirst({
    where: eq(cuttingOrders.id, orderId),
    columns: {
      id: true,
      orderNo: true,
      status: true,
      targetQty: true,
      fabricRollId: true,
      actualFabricYds: true,
      expectedFabricYds: true,
      createdAt: true,
    },
    with: {
      recipe: {
        columns: { id: true, recipeCode: true, name: true, stdFabricYards: true, wastageCap: true },
      },
      createdByUser: { columns: { fullName: true } },
    },
  })
  if (!order) return null

  const items = await loadItems(db, order.id)

  return {
    order: {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      targetQty: order.targetQty,
      fabricRollId: order.fabricRollId,
      actualFabricYds: Number(order.actualFabricYds),
      expectedFabricYds: Number(order.expectedFabricYds),
      createdAt: order.createdAt,
      createdByName: order.createdByUser?.fullName ?? null,
    },
    recipe: {
      id: order.recipe.id,
      recipeCode: order.recipe.recipeCode,
      name: order.recipe.name,
      stdFabricYards: Number(order.recipe.stdFabricYards),
      wastageCap: Number(order.recipe.wastageCap),
    },
    items: items.map(toItemState),
  }
}
