import { NextResponse } from 'next/server'
import { requireRole } from '@/server/auth/guard'
import { handle } from '@/server/http/handler'
import { db } from '@/server/db'
import { listRecipes } from '@/server/services/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handle(request, async () => {
    await requireRole('cutting_supervisor', 'cutting_verifier')
    const recipes = await listRecipes(db)
    return NextResponse.json({ recipes })
  })
}
