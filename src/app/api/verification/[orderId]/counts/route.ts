import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/server/auth/guard'
import { saveCountsSchema } from '@/domain/verification'
import { handle } from '@/server/http/handler'
import { db } from '@/server/db'
import { saveCounts } from '@/server/services/verification'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const orderIdSchema = z.string().uuid('Order id must be a valid UUID')

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  return handle(request, async () => {
    await requireRole('cutting_verifier')
    const { orderId } = await params
    const id = orderIdSchema.parse(orderId)
    const input = saveCountsSchema.parse(await request.json())
    const result = await saveCounts(db, id, input)
    return NextResponse.json(result)
  })
}
