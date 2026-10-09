import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/server/auth/guard'
import { handle } from '@/server/http/handler'
import { db } from '@/server/db'
import { getVerifiedOrderDetail } from '@/server/services/sewing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const idSchema = z.string().uuid('Order id must be a valid UUID')

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(request, async () => {
    await requireRole('sewing_supervisor')
    const { id } = await params
    const orderId = idSchema.parse(id)
    const detail = await getVerifiedOrderDetail(db, orderId)
    return NextResponse.json(detail)
  })
}
