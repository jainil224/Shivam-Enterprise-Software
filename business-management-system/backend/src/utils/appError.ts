/**
 * Typed application error used across Phase 12 services.
 * `errorHandler` already understands `statusCode`, `errors` and `code`.
 */
export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  statusCode: number;
  errors?: FieldError[];
  code?: string;

  constructor(statusCode: number, message: string, errors?: FieldError[], code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.code = code;
  }
}

export function validationError(errors: FieldError[]): never {
  const message = errors.length > 0 ? errors[0].message : 'Validation failed.';
  throw new AppError(400, message, errors, 'VALIDATION_ERROR');
}

export function conflictError(message: string, errors?: FieldError[]): never {
  throw new AppError(409, message, errors, 'CONFLICT');
}

export function notFoundError(message: string): never {
  throw new AppError(404, message, undefined, 'NOT_FOUND');
}