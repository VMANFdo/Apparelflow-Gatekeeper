import { NextResponse } from 'next/server'
import { requireRole } from '@/server/auth/guard'
import { createOrderSchema } from '@/domain/orders'
import { handle } from '@/server/http/handler'
import { db } from '@/server/db'
import { createOrder, listOrders } from '@/server/services/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handle(request, async () => {
    const actor = await requireRole('cutting_supervisor')
    const input = createOrderSchema.parse(await request.json())
    const order = await createOrder(db, actor, input)
    return NextResponse.json(
      {
        order: {
          id: order.id,
          orderNo: order.orderNo,
          status: order.status,
          targetQty: order.targetQty,
          fabricRollId: order.fabricRollId,
          actualFabricYds: Number(order.actualFabricYds),
          expectedFabricYds: Number(order.expectedFabricYds),
          recipeId: order.recipeId,
        },
      },
      { status: 201 }
    )
  })
}

export async function GET(request: Request) {
  return handle(request, async () => {
    const actor = await requireRole('cutting_supervisor', 'cutting_verifier')
    const orders = await listOrders(db, actor)
    return NextResponse.json({ orders })
  })
}
