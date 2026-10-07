import { beforeEach, describe, expect, it } from 'vitest'
import { SignJWT } from 'jose'
import { SESSION_COOKIE, signSession, verifySession } from '@/server/auth/session'

const SECRET = 'unit-test-secret-for-session-signing'
const USER_ID = '11111111-1111-4111-8111-111111111111'

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET
})

describe('signSession / verifySession', () => {
  it('round-trips sub and role', async () => {
    const token = await signSession({ sub: USER_ID, role: 'cutting_verifier' })
    const payload = await verifySession(token)
    expect(payload).toEqual({ sub: USER_ID, role: 'cutting_verifier' })
    expect(SESSION_COOKIE).toBe('appflow_session')
  })

  it('returns null for a missing token', async () => {
    expect(await verifySession(undefined)).toBeNull()
    expect(await verifySession(null)).toBeNull()
    expect(await verifySession('')).toBeNull()
  })

  it('returns null for a tampered or garbage token', async () => {
    const token = await signSession({ sub: USER_ID, role: 'cutting_supervisor' })
    expect(await verifySession(`${token}x`)).toBeNull()
    expect(await verifySession('not-a-jwt')).toBeNull()
  })

  it('returns null when signed with a different secret', async () => {
    const token = await new SignJWT({ role: 'cutting_supervisor' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setExpirationTime('8h')
      .sign(encode('some-other-secret'))
    expect(await verifySession(token)).toBeNull()
  })

  it('returns null for an expired token', async () => {
    const token = await new SignJWT({ role: 'cutting_supervisor' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(encode(SECRET))
    expect(await verifySession(token)).toBeNull()
  })

  it('rejects a payload with an unknown role', async () => {
    const token = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setExpirationTime('8h')
      .sign(encode(SECRET))
    expect(await verifySession(token)).toBeNull()
  })

  it('rejects a token with an HMAC algorithm other than HS256', async () => {
    const token = await new SignJWT({ role: 'cutting_supervisor' })
      .setProtectedHeader({ alg: 'HS384' })
      .setSubject(USER_ID)
      .setExpirationTime('8h')
      .sign(encode(SECRET))
    expect(await verifySession(token)).toBeNull()
  })
})
