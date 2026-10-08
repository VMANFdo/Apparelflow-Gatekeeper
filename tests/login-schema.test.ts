import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { loginSchema } from '@/domain/auth'

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const parsed = loginSchema.parse({
      email: 'supervisor@apparelflow.demo',
      password: 'Supervisor@123',
    })
    expect(parsed).toEqual({
      email: 'supervisor@apparelflow.demo',
      password: 'Supervisor@123',
    })
  })

  it('trims the email before validating', () => {
    const parsed = loginSchema.parse({
      email: '  verifier@apparelflow.demo  ',
      password: 'Verifier@123',
    })
    expect(parsed.email).toBe('verifier@apparelflow.demo')
  })

  it('rejects unknown fields such as a tampered role (400, never honored)', () => {
    expect(() =>
      loginSchema.parse({
        email: 'attacker@apparelflow.demo',
        password: 'whatever',
        role: 'cutting_supervisor',
        id: '00000000-0000-4000-8000-000000000000',
      })
    ).toThrow(ZodError)

    try {
      loginSchema.parse({ email: 'a@b.co', password: 'x', role: 'cutting_supervisor' })
      expect.unreachable('strict schema must reject unknown keys')
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError)
      const issues = (error as ZodError).issues
      const keyIssue = issues.find((i) => i.code === 'unrecognized_keys')
      expect(keyIssue).toBeDefined()
      if (!keyIssue || !('keys' in keyIssue)) throw new Error('expected unrecognized_keys issue')
      expect(keyIssue.keys).toContain('role')
    }
  })

  it('rejects an invalid email or empty password', () => {
    expect(() => loginSchema.parse({ email: 'not-an-email', password: 'x' })).toThrow(ZodError)
    expect(() => loginSchema.parse({ email: 'a@b.co', password: '' })).toThrow(ZodError)
  })

  it('rejects oversized inputs', () => {
    expect(() => loginSchema.parse({ email: 'a'.repeat(300) + '@b.co', password: 'x' })).toThrow(
      ZodError
    )
    expect(() => loginSchema.parse({ email: 'a@b.co', password: 'p'.repeat(129) })).toThrow(
      ZodError
    )
  })
})
