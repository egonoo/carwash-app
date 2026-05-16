import { v4 as uuidv4 } from 'uuid';

export type AddonSelection = { addonId: string; quantity: number };

export type DetectedZoneInfo = {
  id: string;
  name: string;
  extraFeeCents: number;
  matchedBy: 'zip' | 'fallback';
};

export type WizardPhotoStatus = 'ok' | 'broken' | 'invalid';

export type WizardPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  status: WizardPhotoStatus;
  errorMsg?: string;
};

export type WizardState = {
  idempotencyKey: string;
  zoneId: string | null;
  detectedZone: DetectedZoneInfo | null;
  startsAtISO: string | null;
  vehicleTypeId: string | null;
  packageId: string | null;
  addons: AddonSelection[];
  vehicle: {
    make?: string;
    model?: string;
    year?: number;
    color?: string;
    plate?: string;
    plateState?: string;
    vin?: string;
    nickname?: string;
  };
  customer: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    addressCity?: string;
    addressState?: string;
    addressZip?: string;
    addressLat?: number;
    addressLng?: number;
    instructions?: string;
    marketingConsent: boolean;
    nonRefundableAccepted: boolean;
  };
  photos: WizardPhoto[];
  evidenceConsent: {
    currentStateAccepted: boolean;
    marketingUseConsent: boolean;
  };
  promoCode?: string;
  depositMethod: 'card' | 'zelle';
};

export function initialState(idempotencyKey?: string): WizardState {
  return {
    idempotencyKey: idempotencyKey ?? uuidv4(),
    zoneId: null,
    detectedZone: null,
    startsAtISO: null,
    vehicleTypeId: null,
    packageId: null,
    addons: [],
    vehicle: {},
    customer: { marketingConsent: false, nonRefundableAccepted: false },
    photos: [],
    evidenceConsent: { currentStateAccepted: false, marketingUseConsent: false },
    depositMethod: 'card',
  };
}

/**
 * sessionStorage-backed idempotency key. Persists across remounts (browser
 * refresh, route navigation, Fast Refresh in dev) so the server's
 * idempotency lookup can match the original Appointment instead of seeing
 * the same payload as a fresh request that then collides with the slot it
 * just reserved. Scoped per business slug so two tenants in the same
 * browser don't collide. Cleared explicitly by the wizard once a booking
 * has succeeded (see clearPersistedIdempotencyKey).
 */
const STORAGE_NAMESPACE = 'splash:booking:idemp';

function storageKey(businessSlug: string): string {
  return `${STORAGE_NAMESPACE}:${businessSlug}`;
}

export function readPersistedIdempotencyKey(businessSlug: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(storageKey(businessSlug));
  } catch {
    return null;
  }
}

export function writePersistedIdempotencyKey(businessSlug: string, key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(storageKey(businessSlug), key);
  } catch {
    // ignore (quota / private mode)
  }
}

export function clearPersistedIdempotencyKey(businessSlug: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey(businessSlug));
  } catch {
    // ignore
  }
}

/**
 * Compute the idempotency key to use for this wizard mount: reuse the
 * persisted value if there is one, otherwise mint a new UUID and persist it
 * immediately so a refresh during the *same* booking attempt still maps
 * back to the same key on the server.
 */
export function resolveIdempotencyKey(businessSlug: string): string {
  const existing = readPersistedIdempotencyKey(businessSlug);
  if (existing) return existing;
  const fresh = uuidv4();
  writePersistedIdempotencyKey(businessSlug, fresh);
  return fresh;
}

/**
 * Persisted booking-result store. Same sessionStorage pattern as the
 * idempotency key but separately keyed so a stale success entry doesn't
 * block a fresh attempt's key generation. Written on a successful
 * createBookingDraft response. Read on wizard mount so a refresh on the
 * success page still shows the confirmation instead of restarting the
 * wizard and triggering a phantom SLOT_CONFLICT.
 */
const RESULT_NAMESPACE = 'splash:booking:result';
const RESULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function resultStorageKey(businessSlug: string): string {
  return `${RESULT_NAMESPACE}:${businessSlug}`;
}

export type PersistedBookingResult = {
  appointmentId: string;
  depositMethod: 'card' | 'zelle';
  depositAmountCents: number;
  totalCents: number;
  balanceDueOnServiceCents: number;
  /** Epoch ms; used to age the entry out after RESULT_TTL_MS. */
  completedAt: number;
};

export function readPersistedBookingResult(businessSlug: string): PersistedBookingResult | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(resultStorageKey(businessSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedBookingResult;
    if (
      !parsed ||
      typeof parsed.appointmentId !== 'string' ||
      (parsed.depositMethod !== 'card' && parsed.depositMethod !== 'zelle') ||
      typeof parsed.depositAmountCents !== 'number' ||
      typeof parsed.totalCents !== 'number' ||
      typeof parsed.balanceDueOnServiceCents !== 'number' ||
      typeof parsed.completedAt !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.completedAt > RESULT_TTL_MS) {
      // Stale — drop it so a fresh wizard takes over.
      try {
        window.sessionStorage.removeItem(resultStorageKey(businessSlug));
      } catch {
        // ignore
      }
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePersistedBookingResult(
  businessSlug: string,
  result: Omit<PersistedBookingResult, 'completedAt'> & { completedAt?: number },
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PersistedBookingResult = {
      appointmentId: result.appointmentId,
      depositMethod: result.depositMethod,
      depositAmountCents: result.depositAmountCents,
      totalCents: result.totalCents,
      balanceDueOnServiceCents: result.balanceDueOnServiceCents,
      completedAt: result.completedAt ?? Date.now(),
    };
    window.sessionStorage.setItem(resultStorageKey(businessSlug), JSON.stringify(payload));
  } catch {
    // ignore (quota / private mode)
  }
}

export function clearPersistedBookingResult(businessSlug: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(resultStorageKey(businessSlug));
  } catch {
    // ignore
  }
}
