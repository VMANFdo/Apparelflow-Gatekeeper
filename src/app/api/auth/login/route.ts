import { NextResponse, type NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/server/db'
import { users } from '@/db/schema'
import { handle } from '@/server/http/handler'
import { UnauthorizedError } from '@/domain/errors'
import { loginSchema } from '@/domain/auth'
import { signSession, setSessionCookie } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Real bcrypt hash compared against when the email does not exist, so the
// response time does not reveal whether an account is registered.
const DUMMY_HASH = '$2b$10$/IDGR3wZ0eI2KYEnn9/xBer9bqe7rWp4uMnoM2EAruuBTmIQkpH3C'
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const INVALID_CREDENTIALS = 'Invalid email or password'

export async function POST(request: NextRequest) {
  return handle(request, async () => {
    const input = loginSchema.parse(await request.json())
    const email = input.email.toLowerCase()

    const user = await db.query.users.findFirst({ where: eq(users.email, email) })
    const now = Date.now()
    const locked = !!user?.lockedUntil && user.lockedUntil.getTime() > now
    const validPassword = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? DUMMY_HASH
    )

    if (!user || locked || !validPassword || !user.isActive) {
      if (user && !locked && !validPassword) {
        const lockExpired = !!user.lockedUntil && user.lockedUntil.getTime() <= now
        const failedAttempts = (lockExpired ? 0 : user.failedAttempts) + 1
        await db
          .update(users)
          .set({
            failedAttempts,
            ...(failedAttempts >= MAX_FAILED_ATTEMPTS
              ? { lockedUntil: new Date(now + LOCKOUT_MINUTES * 60_000) }
              : { lockedUntil: null }),
          })
          .where(eq(users.id, user.id))
      }
      throw new UnauthorizedError(INVALID_CREDENTIALS)
    }

    if (user.failedAttempts !== 0 || user.lockedUntil !== null) {
      await db
        .update(users)
        .set({ failedAttempts: 0, lockedUntil: null })
        .where(eq(users.id, user.id))
    }

    const token = await signSession({ sub: user.id, role: user.role })
    await setSessionCookie(token)

    return NextResponse.json({
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    })
  })
}
