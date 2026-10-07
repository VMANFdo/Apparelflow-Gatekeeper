import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertSameOrigin, requireRole, requireUser } from '@/server/auth/guard'
import { getCurrentUser, type SessionUser } from '@/server/auth/session'
import { handle } from '@/server/http/handler'
import { ForbiddenError, UnauthorizedError } from '@/domain/errors'

vi.mock('@/server/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/auth/session')>()
  return { ...actual, getCurrentUser: vi.fn() }
})

const mockedGetCurrentUser = vi.mocked(getCurrentUser)

const verifier: SessionUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'verifier@apparelflow.demo',
  role: 'cutting_verifier',
  fullName: 'Cutting Verifier',
  isActive: true,
}

beforeEach(() => {
  mockedGetCurrentUser.mockReset()
})

describe('requireUser', () => {
  it('throws 401 when there is no session', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)
    await expect(requireUser()).rejects.toMatchObject({ status: 401 })
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('returns the user when a session exists', async () => {
    mockedGetCurrentUser.mockResolvedValue(verifier)
    await expect(requireUser()).resolves.toEqual(verifier)
  })
})

describe('requireRole', () => {
  it('throws 403 when the role is not allowed', async () => {
    mockedGetCurrentUser.mockResolvedValue(verifier)
    await expect(requireRole('cutting_supervisor')).rejects.toBeInstanceOf(ForbiddenError)
    await expect(requireRole('cutting_supervisor')).rejects.toMatchObject({ status: 403 })
  })

  it('throws 401 before checking the role when there is no session', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)
    await expect(requireRole('cutting_supervisor')).rejects.toBeInstanceOf(UnauthorizedError)
  })

  it('returns the user when the role matches', async () => {
    mockedGetCurrentUser.mockResolvedValue(verifier)
    await expect(requireRole('cutting_verifier')).resolves.toEqual(verifier)
    await expect(requireRole('cutting_supervisor', 'cutting_verifier')).resolves.toEqual(verifier)
  })
})

describe('assertSameOrigin', () => {
  const url = 'http://localhost:3000/api/orders'

  function post(headers: Record<string, string>) {
    return new Request(url, { method: 'POST', headers, body: '{}' })
  }

  it('allows requests without an Origin header (cURL / Postman)', () => {
    expect(() => assertSameOrigin(post({ 'content-type': 'application/json' }))).not.toThrow()
  })

  it('allows a matching Origin header', () => {
    expect(() =>
      assertSameOrigin(post({ origin: 'http://localhost:3000', host: 'localhost:3000' }))
    ).not.toThrow()
  })

  it('rejects a cross-origin request', () => {
    expect(() =>
      assertSameOrigin(post({ origin: 'https://evil.example.com', host: 'localhost:3000' }))
    ).toThrow(ForbiddenError)
  })

  it('rejects an origin whose scheme does not match the forwarded protocol', () => {
    expect(() =>
      assertSameOrigin(
        post({
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
          'x-forwarded-proto': 'https',
        })
      )
    ).toThrow(ForbiddenError)
  })

  it('ignores the Origin header on safe methods', () => {
    const req = new Request(url, { headers: { origin: 'https://evil.example.com' } })
    expect(() => assertSameOrigin(req)).not.toThrow()
  })

  it('is enforced by the handle() wrapper before the handler runs', async () => {
    const fn = vi.fn(() => Response.json({ ok: true }))
    const res = await handle(
      post({ origin: 'https://evil.example.com', host: 'localhost:3000' }),
      fn
    )
    expect(res.status).toBe(403)
    expect(fn).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('lets a same-origin request through handle()', async () => {
    const res = await handle(
      post({ origin: 'http://localhost:3000', host: 'localhost:3000' }),
      () => Response.json({ ok: true })
    )
    expect(res.status).toBe(200)
  })
})
