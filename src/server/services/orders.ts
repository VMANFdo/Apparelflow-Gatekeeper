import { asc, desc, eq, sql } from 'drizzle-orm'
import {
  cuttingOrders,
  recipeComponents,
  recipes,
  verificationItems,
  verificationLogs,
  type OrderStatus,
} from '@/db/schema'
import { ConflictError, NotFoundError, BusinessRuleError } from '@/domain/errors'
import {
  computeExpectedFabric,
  computeExpectedPieces,
  type CreateOrderInput,
} from '@/domain/orders'
import type { Db } from '@/server/db'
import type { SessionUser } from '@/server/auth/session'

export function formatOrderNo(next: number): string {
  return `CO-${new Date().getFullYear()}-${String(next).padStart(4, '0')}`
}

export async function createOrder(db: Db, actor: SessionUser, input: CreateOrderInput) {
  return db.transaction(async (tx) => {
    const recipe = await tx.query.recipes.findFirst({
      where: eq(recipes.id, input.recipe_id),
      with: { components: true },
    })
    if (!recipe) throw new NotFoundError('Recipe not found')
    if (recipe.components.length === 0) {
      throw new BusinessRuleError('Recipe has no components to verify')
    }

    const seqRows = await tx.execute(sql`select nextval('order_no_seq') as n`)
    const orderNo = formatOrderNo(Number((seqRows as unknown as { n: string | number }[])[0].n))

    const expectedFabricYds = computeExpectedFabric(
      Number(recipe.stdFabricYards),
      input.target_qty
    )

    const [order] = await tx
      .insert(cuttingOrders)
      .values({
        orderNo,
        recipeId: recipe.id,
        targetQty: input.target_qty,
        fabricRollId: input.fabric_roll_id,
        actualFabricYds: input.actual_fabric_yds.toFixed(2),
        expectedFabricYds: expectedFabricYds.toFixed(2),
        status: 'PENDING_VERIFICATION',
        createdBy: actor.id,
      })
      .returning()
    if (!order) throw new Error('Failed to insert cutting order')

    const expectedPieces = computeExpectedPieces(
      recipe.components.map((component) => ({
        id: component.id,
        piecesPerGarment: component.piecesPerGarment,
      })),
      input.target_qty
    )

    await tx.insert(verificationItems).values(
      expectedPieces.map((piece) => ({
        orderId: order.id,
        componentId: piece.componentId,
        expectedQty: piece.expectedQty,
        actualQty: null,
        status: null,
      }))
    )

    return order
  })
}

export interface OrderListItem {
  id: string
  orderNo: string
  status: OrderStatus
  targetQty: number
  fabricRollId: string
  actualFabricYds: number
  expectedFabricYds: number
  createdAt: Date
  rejectionNote: string | null
  createdByName: string | null
  recipe: {
    id: string
    recipeCode: string
    name: string
    category: string
    stdFabricYards: number
    wastageCap: number
  }
}

export async function listOrders(db: Db, actor: SessionUser): Promise<OrderListItem[]> {
  const orders = await db.query.cuttingOrders.findMany({
    where:
      actor.role === 'cutting_verifier'
        ? eq(cuttingOrders.status, 'PENDING_VERIFICATION')
        : undefined,
    orderBy: [desc(cuttingOrders.createdAt)],
    with: {
      recipe: true,
      createdByUser: { columns: { fullName: true } },
      logs: {
        orderBy: [desc(verificationLogs.createdAt)],
        columns: { decision: true, rejectionNote: true },
      },
    },
  })

  return orders.map((order) => ({
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    targetQty: order.targetQty,
    fabricRollId: order.fabricRollId,
    actualFabricYds: Number(order.actualFabricYds),
    expectedFabricYds: Number(order.expectedFabricYds),
    createdAt: order.createdAt,
    rejectionNote:
      order.status === 'REJECTED'
        ? (order.logs.find((log) => log.decision === 'REJECTED')?.rejectionNote ?? null)
        : null,
    createdByName: order.createdByUser?.fullName ?? null,
    recipe: {
      id: order.recipe.id,
      recipeCode: order.recipe.recipeCode,
      name: order.recipe.name,
      category: order.recipe.category,
      stdFabricYards: Number(order.recipe.stdFabricYards),
      wastageCap: Number(order.recipe.wastageCap),
    },
  }))
}

export interface RecipeListItem {
  id: string
  recipeCode: string
  name: string
  category: string
  stdFabricYards: number
  wastageCap: number
  components: {
    id: string
    componentName: string
    piecesPerGarment: number
    imageUrl: string | null
  }[]
}

export async function listRecipes(db: Db): Promise<RecipeListItem[]> {
  const allRecipes = await db.query.recipes.findMany({
    orderBy: [asc(recipes.recipeCode)],
    with: {
      components: { orderBy: [asc(recipeComponents.componentName)] },
    },
  })

  return allRecipes.map((recipe) => ({
    id: recipe.id,
    recipeCode: recipe.recipeCode,
    name: recipe.name,
    category: recipe.category,
    stdFabricYards: Number(recipe.stdFabricYards),
    wastageCap: Number(recipe.wastageCap),
    components: recipe.components.map((component) => ({
      id: component.id,
      componentName: component.componentName,
      piecesPerGarment: component.piecesPerGarment,
      imageUrl: component.imageUrl,
    })),
  }))
}

export async function resubmitOrder(db: Db, orderId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(cuttingOrders)
      .where(eq(cuttingOrders.id, orderId))
      .for('update')
    if (!order) throw new NotFoundError('Order not found')
    if (order.status !== 'REJECTED') {
      throw new ConflictError('Only rejected orders can be resubmitted')
    }

    await tx
      .update(verificationItems)
      .set({ actualQty: null, status: null })
      .where(eq(verificationItems.orderId, orderId))

    const [updated] = await tx
      .update(cuttingOrders)
      .set({ status: 'PENDING_VERIFICATION', updatedAt: new Date() })
      .where(eq(cuttingOrders.id, orderId))
      .returning()
    if (!updated) throw new Error('Failed to resubmit order')

    return updated
  })
}
