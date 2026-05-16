/**
 * Pure validators + error humanizer for the booking wizard. Mirrors the
 * server-side Zod schemas in @splash/schemas but lives client-side so each
 * step can gate "Continue" and surface inline messages before the customer
 * ever hits the network. The Zod schemas remain the source of truth — these
 * helpers only refuse to send obviously-bad input.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const E164_RE = /^\+[1-9]\d{1,14}$/;
export const ZIP_RE = /^[A-Za-z0-9\- ]{3,12}$/;
export const STATE_RE = /^[A-Za-z]{2}$/;
export const PLATE_STATE_RE = /^[A-Za-z]{2}$/;
export const PLATE_RE = /^[A-Z0-9\- ]{1,15}$/;
export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export function isEmail(value: string | undefined): boolean {
  if (!value) return false;
  return EMAIL_RE.test(value.trim());
}

export function isE164(value: string | undefined): boolean {
  if (!value) return false;
  return E164_RE.test(value.trim());
}

export function isZip(value: string | undefined): boolean {
  if (!value) return false;
  return ZIP_RE.test(value.trim());
}

export function isUSState(value: string | undefined): boolean {
  if (!value) return false;
  return STATE_RE.test(value.trim());
}

export function isPlateState(value: string | undefined): boolean {
  if (!value) return true; // optional
  return PLATE_STATE_RE.test(value.trim());
}

export function isYear(value: number | undefined): boolean {
  if (value === undefined || value === null) return true; // optional
  if (!Number.isFinite(value)) return false;
  return Number.isInteger(value) && value >= MIN_YEAR && value <= MAX_YEAR;
}

/**
 * Force input to 2 uppercase letters. Strips digits, punctuation and
 * accents. Returns "" if nothing usable was entered.
 */
export function normalizePlateState(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 2)
    .toUpperCase();
}

/** Force input to a license-plate-ish shape: A-Z, 0-9, dash, space, up to 15 chars. */
export function normalizePlate(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[^A-Za-z0-9\- ]/g, '')
    .slice(0, 15)
    .toUpperCase();
}

/**
 * Best-effort normalization of a phone number to E.164. Customers paste in
 * all kinds of formats — `(305) 555-1234`, `305 555 1234`, `1-305-555-1234`,
 * `+1 305 555 1234`. We never *force* the result; if we can't safely build
 * an E.164 we return the trimmed input so the explicit isE164 check
 * downstream can produce the right error.
 */
export function normalizePhoneE164(raw: string, defaultCountryCode = '1'): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const startsWithPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  if (startsWithPlus) return `+${digits}`;
  // US/CA default: 10 digits → +1XXXXXXXXXX; 11 digits starting with 1 → +1...
  if (defaultCountryCode === '1') {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  }
  return `+${digits}`;
}

// ---------------------------------------------------------------------------
// Server error humanizer
// ---------------------------------------------------------------------------

type ApiErrorBody = {
  ok?: false;
  code?: string;
  message?: string;
  details?: unknown;
};

export type HumanizedError = {
  title: string;
  /** Short paragraph for the customer. Never raw JSON. */
  message: string;
  /** Optional bullet list of specific field problems (already humanized). */
  fieldHints: string[];
  /** Server code for telemetry/branching. */
  code: string;
};

const GENERIC: HumanizedError = {
  title: 'Something went wrong',
  message: 'We could not complete your booking just now. Please try again in a moment.',
  fieldHints: [],
  code: 'INTERNAL',
};

/**
 * Turn an arbitrary server error payload (or a thrown Error) into a
 * customer-friendly message. Specifically detects:
 *   - AppError JSON bodies ({ code, message, details })
 *   - Zod issue arrays leaked through INTERNAL.message
 *   - Plain Error objects
 */
export function humanizeBookingError(input: unknown): HumanizedError {
  if (!input) return GENERIC;

  const body: ApiErrorBody | null =
    typeof input === 'object' && input !== null && !(input instanceof Error)
      ? (input as ApiErrorBody)
      : null;

  const errorMsg = body?.message ?? (input instanceof Error ? input.message : undefined);
  const code = body?.code ?? 'INTERNAL';

  // VALIDATION_ERROR — details may be a z.flatten() object, a list of
  // ZodIssues, or already a string[]. Normalize.
  if (code === 'VALIDATION_ERROR' || /"code"\s*:\s*"invalid/.test(errorMsg ?? '')) {
    const hints = extractFieldHints(body?.details, errorMsg);
    return {
      title: 'Please check your details',
      message:
        hints.length > 0
          ? 'We need a few things fixed before we can hold this slot:'
          : 'Some of the details look off. Please review the form and try again.',
      fieldHints: hints,
      code: 'VALIDATION_ERROR',
    };
  }

  switch (code) {
    case 'SLOT_CONFLICT':
      return {
        title: 'Time just got taken',
        message:
          'That slot was reserved by someone else in the last few seconds. Please go back and pick another time.',
        fieldHints: [],
        code,
      };
    case 'DOUBLE_BOOKING':
      return {
        title: 'No team available',
        message:
          'There is no crew free for that exact window. Please go back and pick a different time.',
        fieldHints: [],
        code,
      };
    case 'DEPOSIT_ALREADY_PAID':
      return {
        title: 'Deposit already received',
        message: 'This reservation has already been paid. You do not need to pay again.',
        fieldHints: [],
        code,
      };
    case 'RATE_LIMITED':
      return {
        title: 'Too many attempts',
        message: 'You have tried this a few times in quick succession. Please wait a minute and try again.',
        fieldHints: [],
        code,
      };
    case 'FEATURE_DISABLED':
      return {
        title: 'Not available right now',
        message: 'This option is currently disabled for this business. Please pick a different one or contact support.',
        fieldHints: [],
        code,
      };
    case 'STRIPE_ERROR':
      return {
        title: 'Payment could not start',
        message:
          errorMsg && errorMsg.length < 240
            ? errorMsg
            : 'Your card processor returned an error. Please try a different card or try again shortly.',
        fieldHints: [],
        code,
      };
    case 'IDEMPOTENCY_MISMATCH':
      return {
        title: 'Duplicate request',
        message: 'It looks like this booking was already submitted. Please refresh and check your email.',
        fieldHints: [],
        code,
      };
    case 'NOT_FOUND':
      return {
        title: 'Something has changed',
        message: 'One of the items you picked is no longer available. Please go back and review your selection.',
        fieldHints: [],
        code,
      };
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
      return {
        title: 'Not allowed',
        message: 'You are not allowed to do this. If this looks wrong, please contact support.',
        fieldHints: [],
        code,
      };
  }

  return {
    ...GENERIC,
    message: errorMsg && errorMsg.length < 240 && !errorMsg.startsWith('[') ? errorMsg : GENERIC.message,
  };
}

// ---------------------------------------------------------------------------

type ZodIssueLike = { path?: Array<string | number>; message?: string };

function extractFieldHints(details: unknown, fallbackMessage: string | undefined): string[] {
  const out: string[] = [];

  // 1) z.flatten().fieldErrors — { customer: ['Required'], ... }
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const obj = details as Record<string, unknown>;
    if (obj.fieldErrors && typeof obj.fieldErrors === 'object') {
      for (const [field, errs] of Object.entries(obj.fieldErrors as Record<string, string[]>)) {
        if (Array.isArray(errs) && errs.length > 0) {
          for (const e of errs) out.push(`${humanizeFieldName(field)}: ${e}`);
        }
      }
    }
    if (Array.isArray(obj.formErrors)) {
      for (const e of obj.formErrors as string[]) out.push(e);
    }
  }

  // 2) Direct array of ZodIssue
  if (Array.isArray(details)) {
    for (const issue of details as ZodIssueLike[]) {
      const field = (issue.path ?? []).map(String).join('.') || 'form';
      out.push(`${humanizeFieldName(field)}: ${issue.message ?? 'invalid'}`);
    }
  }

  // 3) Raw ZodError JSON in message — best-effort parse.
  if (out.length === 0 && fallbackMessage && fallbackMessage.startsWith('[')) {
    try {
      const parsed = JSON.parse(fallbackMessage) as ZodIssueLike[];
      if (Array.isArray(parsed)) {
        for (const issue of parsed) {
          const field = (issue.path ?? []).map(String).join('.') || 'form';
          out.push(`${humanizeFieldName(field)}: ${issue.message ?? 'invalid'}`);
        }
      }
    } catch {
      // ignore
    }
  }

  // Deduplicate while preserving order, cap to 8 for visual sanity.
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const h of out) {
    if (seen.has(h)) continue;
    seen.add(h);
    deduped.push(h);
    if (deduped.length >= 8) break;
  }
  return deduped;
}

const FIELD_LABELS: Record<string, string> = {
  'customer.email': 'Email',
  'customer.phone': 'Phone',
  'customer.firstName': 'First name',
  'customer.lastName': 'Last name',
  'customer.addressLine1': 'Address',
  'customer.addressLine2': 'Apartment / suite',
  'customer.addressCity': 'City',
  'customer.addressState': 'State',
  'customer.addressZip': 'ZIP',
  'customer.nonRefundableDepositAccepted': 'Deposit acknowledgement',
  'vehicle.make': 'Make',
  'vehicle.model': 'Model',
  'vehicle.year': 'Year',
  'vehicle.color': 'Color',
  'vehicle.plate': 'License plate',
  'vehicle.plateState': 'Plate state',
  'vehicle.vin': 'VIN',
  startsAt: 'Time slot',
  zoneId: 'Service area',
  packageId: 'Package',
  vehicleTypeId: 'Vehicle size',
  'evidenceConsent.currentStateAccepted': 'Condition acknowledgement',
  depositMethod: 'Deposit method',
};

function humanizeFieldName(path: string): string {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];
  const last = path.split('.').pop() ?? path;
  // camelCase / snake_case → Title Case
  return last
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
