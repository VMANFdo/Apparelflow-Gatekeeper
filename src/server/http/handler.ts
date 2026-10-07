import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError } from '@/domain/errors'

type Handler = () => Response | Promise<Response>

function jsonError(status: number, code: string, message: string, details: string[] = []) {
  return NextResponse.json({ error: { code, message, details } }, { status })
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return jsonError(error.status, error.code, error.message, error.details)
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'body'
      return `${path}: ${issue.message}`
    })
    return jsonError(400, 'VALIDATION_ERROR', 'Validation failed', details)
  }

  if (error instanceof SyntaxError) {
    return jsonError(400, 'VALIDATION_ERROR', 'Malformed JSON body')
  }

  console.error('Unhandled error:', error)
  return jsonError(500, 'INTERNAL_ERROR', 'Internal server error')
}

export async function handle(request: Request, fn: Handler): Promise<Response> {
  try {
    return await fn()
  } catch (error) {
    return errorResponse(error)
  }
}
