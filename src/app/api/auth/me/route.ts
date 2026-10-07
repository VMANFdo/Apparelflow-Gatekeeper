import { NextResponse, type NextRequest } from 'next/server'
import { handle } from '@/server/http/handler'
import { UnauthorizedError } from '@/domain/errors'
import { getCurrentUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return handle(request, async () => {
    const user = await getCurrentUser()
    if (!user) throw new UnauthorizedError()
    return NextResponse.json({ user })
  })
}
