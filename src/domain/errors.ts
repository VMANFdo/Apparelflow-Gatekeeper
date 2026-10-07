export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly details: string[]

  constructor(status: number, code: string, message: string, details: string[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details: string[] = []) {
    super(400, 'VALIDATION_ERROR', message, details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'FORBIDDEN', message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'The resource is in a state that does not allow this operation') {
    super(409, 'CONFLICT', message)
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details: string[] = []) {
    super(422, 'BUSINESS_RULE', message, details)
  }
}
