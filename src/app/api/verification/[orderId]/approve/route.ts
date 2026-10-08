import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/server/auth/guard'
import { approveOrderSchema } from '@/domain/verification'
import { handle } from '@/server/http/handler'
import { db } from '@/server/db'
import { approveOrder } from '@/server/services/verification'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const orderIdSchema = z.string().uuid('Order id must be a valid UUID')

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  return handle(request, async () => {
    const actor = await requireRole('cutting_verifier')
    const { orderId } = await params
    const id = orderIdSchema.parse(orderId)
    const raw = await request.text()
    const input = approveOrderSchema.parse(raw.trim().length > 0 ? JSON.parse(raw) : {})
    const result = await approveOrder(db, actor, id, input)
    return NextResponse.json(result)
  })
}
