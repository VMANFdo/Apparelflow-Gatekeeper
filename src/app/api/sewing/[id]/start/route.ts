import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/server/auth/guard'
import { handle } from '@/server/http/handler'
import { db } from '@/server/db'
import { startSewing } from '@/server/services/sewing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const idSchema = z.string().uuid('Order id must be a valid UUID')

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(request, async () => {
    // actor comes from the session — sewing_started_by is never trusted from the body
    const actor = await requireRole('sewing_supervisor')
    const { id } = await params
    const orderId = idSchema.parse(id)
    const result = await startSewing(db, actor, orderId)
    return NextResponse.json(result)
  })
}
