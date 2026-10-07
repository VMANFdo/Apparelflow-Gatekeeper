import type { Role } from '@/db/schema'
import { ForbiddenError, UnauthorizedError } from '@/domain/errors'
import { getCurrentUser, type SessionUser } from '@/server/auth/session'

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new UnauthorizedError()
  return user
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) throw new ForbiddenError()
  return user
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function assertSameOrigin(request: Request): void {
  if (!MUTATING_METHODS.has(request.method)) return

  const origin = request.headers.get('origin')
  if (origin === null) return // no Origin header (cURL / Postman) is allowed

  const host = request.headers.get('host')
  const protocol = (
    request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(/:$/, '')
  )
    .split(',')[0]
    .trim()

  if (!host || origin !== `${protocol}://${host}`) {
    throw new ForbiddenError('Cross-origin request rejected')
  }
}
