import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/server/auth/guard'
import { handle } from '@/server/http/handler'
import { db } from '@/server/db'
import { resubmitOrder } from '@/server/services/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const orderIdSchema = z.string().uuid('Order id must be a valid UUID')

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(request, async () => {
    await requireRole('cutting_supervisor')
    const { id } = await params
    const orderId = orderIdSchema.parse(id)
    const order = await resubmitOrder(db, orderId)
    return NextResponse.json({
      order: {
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
      },
    })
  })
}
