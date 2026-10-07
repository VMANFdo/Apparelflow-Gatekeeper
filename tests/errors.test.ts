import { describe, expect, it } from 'vitest'
import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/domain/errors'
import { errorResponse, handle } from '@/server/http/handler'

async function readBody(res: Response) {
  return res.json()
}

describe('AppError subclasses', () => {
  it('maps each subclass to its HTTP status', () => {
    expect(new ValidationError().status).toBe(400)
    expect(new UnauthorizedError().status).toBe(401)
    expect(new ForbiddenError().status).toBe(403)
    expect(new NotFoundError().status).toBe(404)
    expect(new ConflictError().status).toBe(409)
    expect(new BusinessRuleError('x').status).toBe(422)
  })

  it('exposes a stable code and details array', () => {
    const err = new BusinessRuleError('Blocked', ['Front Body Panel: shortage -3'])
    expect(err).toBeInstanceOf(AppError)
    expect(err.code).toBe('BUSINESS_RULE')
    expect(err.details).toEqual(['Front Body Panel: shortage -3'])
    expect(new ValidationError().details).toEqual([])
  })
})

describe('errorResponse', () => {
  it('returns the error JSON shape with the mapped status', async () => {
    const res = errorResponse(new ConflictError('Already processed'))
    expect(res.status).toBe(409)
    expect(await readBody(res)).toEqual({
      error: { code: 'CONFLICT', message: 'Already processed', details: [] },
    })
  })

  it('maps ZodError to 400 with per-field details', async () => {
    const { z } = await import('zod')
    const schema = z.object({ target_qty: z.number().int() })
    const result = schema.safeParse({ target_qty: 'abc' })
    const res = errorResponse(result.error)
    expect(res.status).toBe(400)
    const body = await readBody(res)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details[0]).toContain('target_qty')
  })

  it('maps malformed JSON SyntaxError to 400', async () => {
    const res = errorResponse(new SyntaxError('Unexpected end of JSON input'))
    expect(res.status).toBe(400)
    expect((await readBody(res)).error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 500 with a generic message and never leaks the stack trace', async () => {
    const res = errorResponse(new Error('select * from users where password'))
    expect(res.status).toBe(500)
    const body = await readBody(res)
    expect(body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: [],
    })
    expect(JSON.stringify(body)).not.toContain('password')
    expect(JSON.stringify(body)).not.toContain('stack')
  })
})

describe('handle', () => {
  it('returns the handler response on success', async () => {
    const res = await handle(new Request('http://localhost/api'), () => Response.json({ ok: true }))
    expect(res.status).toBe(200)
    expect(await readBody(res)).toEqual({ ok: true })
  })

  it('catches AppError thrown inside the handler', async () => {
    const res = await handle(new Request('http://localhost/api'), () => {
      throw new ForbiddenError()
    })
    expect(res.status).toBe(403)
    expect((await readBody(res)).error.code).toBe('FORBIDDEN')
  })

  it('catches unexpected errors as 500', async () => {
    const res = await handle(new Request('http://localhost/api'), () => {
      throw new Error('boom')
    })
    expect(res.status).toBe(500)
  })

  it('catches async rejections', async () => {
    const res = await handle(new Request('http://localhost/api'), async () => {
      throw new NotFoundError('Order not found')
    })
    expect(res.status).toBe(404)
    expect((await readBody(res)).error.message).toBe('Order not found')
  })
})
