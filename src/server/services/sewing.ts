import { and, eq } from 'drizzle-orm'
import { cuttingOrders, verificationLogs } from '@/db/schema'
import { ConflictError, NotFoundError } from '@/domain/errors'
import type { SessionUser } from '@/server/auth/session'
import type { Db } from '@/server/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SewingQueueItem {
  id: string
  orderNo: string
  targetQty: number
  fabricRollId: string
  actualFabricYds: number
  expectedFabricYds: number
  createdAt: Date
  verifiedAt: Date
  verifierName: string | null
  approvalNote: string | null
  wastagePct: number
  recipe: {
    id: string
    recipeCode: string
    name: string
    category: string
    wastageCap: number
  }
  sewingStartedAt: Date | null
  sewingStartedByName: string | null
}

export interface SewingItemVariance {
  componentId: string
  componentName: string
  expectedQty: number
  actualQty: number | null
  variance: number | null
  status: 'GREEN' | 'YELLOW' | 'RED' | null
}

export interface SewingQueueDetailItem extends SewingQueueItem {
  items: SewingItemVariance[]
}

// ─── listVerifiedQueue ────────────────────────────────────────────────────────
// Hard-codes WHERE status = 'VERIFIED'. Zero URL params are accepted or passed.

export async function listVerifiedQueue(db: Db): Promise<SewingQueueItem[]> {
  const orders = await db.query.cuttingOrders.findMany({
    where: eq(cuttingOrders.status, 'VERIFIED'),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
    columns: {
      id: true,
      orderNo: true,
      targetQty: true,
      fabricRollId: true,
      actualFabricYds: true,
      expectedFabricYds: true,
      createdAt: true,
      sewingStartedAt: true,
    },
    with: {
      recipe: {
        columns: { id: true, recipeCode: true, name: true, category: true, wastageCap: true },
      },
      sewingStartedByUser: { columns: { fullName: true } },
      logs: {
        where: eq(verificationLogs.decision, 'APPROVED'),
        columns: { createdAt: true, wastagePct: true, approvalNote: true },
        with: { verifier: { columns: { fullName: true } } },
        limit: 1, // partial unique index guarantees at most one APPROVED log per order
      },
    },
  })

  return orders.map((order) => {
    const approvedLog = order.logs[0]
    return {
      id: order.id,
      orderNo: order.orderNo,
      targetQty: order.targetQty,
      fabricRollId: order.fabricRollId,
      actualFabricYds: Number(order.actualFabricYds),
      expectedFabricYds: Number(order.expectedFabricYds),
      createdAt: order.createdAt,
      verifiedAt: approvedLog?.createdAt ?? order.createdAt,
      verifierName: approvedLog?.verifier?.fullName ?? null,
      approvalNote: approvedLog?.approvalNote ?? null,
      wastagePct: approvedLog ? Number(approvedLog.wastagePct) : 0,
      recipe: {
        id: order.recipe.id,
        recipeCode: order.recipe.recipeCode,
        name: order.recipe.name,
        category: order.recipe.category,
        wastageCap: Number(order.recipe.wastageCap),
      },
      sewingStartedAt: order.sewingStartedAt,
      sewingStartedByName: order.sewingStartedByUser?.fullName ?? null,
    }
  })
}

// ─── getVerifiedOrderDetail ───────────────────────────────────────────────────
// WHERE id = ? AND status = 'VERIFIED'. Throws NotFoundError (→ 404) otherwise.

export async function getVerifiedOrderDetail(
  db: Db,
  orderId: string
): Promise<SewingQueueDetailItem> {
  const order = await db.query.cuttingOrders.findFirst({
    where: and(eq(cuttingOrders.id, orderId), eq(cuttingOrders.status, 'VERIFIED')),
    columns: {
      id: true,
      orderNo: true,
      targetQty: true,
      fabricRollId: true,
      actualFabricYds: true,
      expectedFabricYds: true,
      createdAt: true,
      sewingStartedAt: true,
    },
    with: {
      recipe: {
        columns: { id: true, recipeCode: true, name: true, category: true, wastageCap: true },
      },
      sewingStartedByUser: { columns: { fullName: true } },
      logs: {
        where: eq(verificationLogs.decision, 'APPROVED'),
        columns: { createdAt: true, wastagePct: true, approvalNote: true },
        with: { verifier: { columns: { fullName: true } } },
        limit: 1,
      },
      items: {
        columns: { componentId: true, expectedQty: true, actualQty: true, status: true },
        with: { component: { columns: { componentName: true } } },
      },
    },
  })

  if (!order) throw new NotFoundError('Order not found or not verified')

  const approvedLog = order.logs[0]

  return {
    id: order.id,
    orderNo: order.orderNo,
    targetQty: order.targetQty,
    fabricRollId: order.fabricRollId,
    actualFabricYds: Number(order.actualFabricYds),
    expectedFabricYds: Number(order.expectedFabricYds),
    createdAt: order.createdAt,
    verifiedAt: approvedLog?.createdAt ?? order.createdAt,
    verifierName: approvedLog?.verifier?.fullName ?? null,
    approvalNote: approvedLog?.approvalNote ?? null,
    wastagePct: approvedLog ? Number(approvedLog.wastagePct) : 0,
    recipe: {
      id: order.recipe.id,
      recipeCode: order.recipe.recipeCode,
      name: order.recipe.name,
      category: order.recipe.category,
      wastageCap: Number(order.recipe.wastageCap),
    },
    sewingStartedAt: order.sewingStartedAt,
    sewingStartedByName: order.sewingStartedByUser?.fullName ?? null,
    items: order.items.map((item) => ({
      componentId: item.componentId,
      componentName: item.component.componentName,
      expectedQty: item.expectedQty,
      actualQty: item.actualQty,
      variance: item.actualQty !== null ? item.actualQty - item.expectedQty : null,
      status: item.status,
    })),
  }
}

// ─── startSewing ─────────────────────────────────────────────────────────────
// Lock the row; require VERIFIED + sewing_started_at IS NULL; set both fields.
// The order status remains VERIFIED — it does NOT change.

export async function startSewing(db: Db, actor: SessionUser, orderId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(cuttingOrders)
      .where(eq(cuttingOrders.id, orderId))
      .for('update')

    if (!order) throw new NotFoundError('Order not found')

    if (order.status !== 'VERIFIED') {
      throw new ConflictError('Only verified orders can be started for sewing')
    }
    if (order.sewingStartedAt !== null) {
      throw new ConflictError('Sewing assembly has already been started for this order')
    }

    const now = new Date()
    const [updated] = await tx
      .update(cuttingOrders)
      .set({ sewingStartedAt: now, sewingStartedBy: actor.id, updatedAt: now })
      .where(eq(cuttingOrders.id, orderId))
      .returning()

    if (!updated) throw new Error('Failed to update order')

    return {
      id: updated.id,
      orderNo: updated.orderNo,
      sewingStartedAt: updated.sewingStartedAt,
    }
  })
}
