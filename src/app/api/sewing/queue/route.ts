import { NextResponse } from 'next/server'
import { requireRole } from '@/server/auth/guard'
import { handle } from '@/server/http/handler'
import { db } from '@/server/db'
import { listVerifiedQueue } from '@/server/services/sewing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// URL query params are intentionally NOT read — the query is hard-coded to
// WHERE status = 'VERIFIED'. Accepting a status param would be a security flaw.
export async function GET(request: Request) {
  return handle(request, async () => {
    await requireRole('sewing_supervisor')
    const queue = await listVerifiedQueue(db)
    return NextResponse.json(queue)
  })
}
