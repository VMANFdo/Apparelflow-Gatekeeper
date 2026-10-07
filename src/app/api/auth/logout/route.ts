import { NextResponse, type NextRequest } from 'next/server'
import { handle } from '@/server/http/handler'
import { clearSessionCookie } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return handle(request, async () => {
    await clearSessionCookie()
    return NextResponse.json({ success: true })
  })
}
