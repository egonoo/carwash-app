export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SLOT_CONFLICT'
  | 'DOUBLE_BOOKING'
  | 'DEPOSIT_ALREADY_PAID'
  | 'FEATURE_DISABLED'
  | 'RATE_LIMITED'
  | 'STRIPE_ERROR'
  | 'IDEMPOTENCY_MISMATCH'
  | 'PHOTO_VIRUS_DETECTED'
  | 'INVALID_STATE_TRANSITION'
  | 'INTERNAL';

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;
  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const errs = {
  unauthorized: () => new AppError('UNAUTHORIZED', 'Authentication required', 401),
  forbidden: (msg = 'Forbidden') => new AppError('FORBIDDEN', msg, 403),
  notFound: (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found`, 404),
  validation: (details?: unknown) => new AppError('VALIDATION_ERROR', 'Invalid input', 400, details),
  slotConflict: () => new AppError('SLOT_CONFLICT', 'Time slot is not available', 409),
  doubleBooking: () => new AppError('DOUBLE_BOOKING', 'Resource already booked', 409),
  depositAlreadyPaid: () => new AppError('DEPOSIT_ALREADY_PAID', 'Deposit already captured', 409),
  featureDisabled: (feature: string) =>
    new AppError('FEATURE_DISABLED', `Feature disabled: ${feature}`, 403),
  rateLimited: () => new AppError('RATE_LIMITED', 'Too many requests', 429),
  stripe: (msg: string) => new AppError('STRIPE_ERROR', msg, 402),
  idempotency: () => new AppError('IDEMPOTENCY_MISMATCH', 'Idempotency key conflict', 422),
  invalidTransition: (from: string, to: string) =>
    new AppError('INVALID_STATE_TRANSITION', `Cannot transition from ${from} to ${to}`, 409),
};

export function toResponseBody(err: unknown) {
  if (err instanceof AppError) {
    return { ok: false as const, code: err.code, message: err.message, details: err.details };
  }
  const e = err as any;
  return { ok: false as const, code: 'INTERNAL' as ErrorCode, message: e?.message ?? 'Internal error' };
}
