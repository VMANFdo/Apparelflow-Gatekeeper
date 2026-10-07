import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { roleEnum, users, type Role, type User } from '@/db/schema'

export const SESSION_COOKIE = 'appflow_session'
const SESSION_TTL_SECONDS = 8 * 60 * 60

export type SessionPayload = { sub: string; role: Role }
export type SessionUser = Pick<User, 'id' | 'email' | 'role' | 'fullName' | 'isActive'>

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

function cookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    ...(maxAge !== undefined ? { maxAge } : {}),
  }
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySession(
  token: string | null | undefined
): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null
    if (!roleEnum.enumValues.includes(payload.role as Role)) return null
    return { sub: payload.sub, role: payload.role as Role }
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_SECONDS))
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, '', cookieOptions(0))
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const session = await verifySession(token)
  if (!session) return null

  const { db } = await import('@/server/db')
  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub) })
  if (!user || !user.isActive) return null

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    isActive: user.isActive,
  }
}
