import { NextResponse, type NextRequest } from 'next/server'
import { handle } from '@/server/http/handler'
import { requireUser } from '@/server/auth/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return handle(request, async () => {
    const user = await requireUser()
    return NextResponse.json({ user })
  })
}
