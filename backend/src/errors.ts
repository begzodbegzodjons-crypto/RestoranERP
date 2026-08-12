/**
 * Typed application errors mapped to HTTP status codes.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(message: string, code = 'UNAUTHORIZED') {
    super(401, code, message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(404, 'NOT_FOUND', `${resource} not found${id ? `: ${id}` : ''}`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, 'CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(public readonly existingResult: unknown) {
    super(200, 'IDEMPOTENT_REPLAY', 'Request already processed — returning cached result');
    this.name = 'IdempotencyConflictError';
  }
}

export class LockTimeoutError extends AppError {
  constructor(message = 'Resource is locked by another transaction') {
    super(503, 'LOCK_TIMEOUT', message);
    this.name = 'LockTimeoutError';
  }
}
