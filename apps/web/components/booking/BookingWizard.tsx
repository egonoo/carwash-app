'use client';

import { useCallback, useState } from 'react';
import { StepZone } from './StepZone';
import { StepDateTime } from './StepDateTime';
import { StepVehicle } from './StepVehicle';
import { StepPackage } from './StepPackage';
import { StepAddons } from './StepAddons';
import { StepCustomer } from './StepCustomer';
import { StepPhotos } from './StepPhotos';
import { StepReviewPay } from './StepReviewPay';
import { BookingSuccessCard } from './BookingSuccessCard';
import {
  clearPersistedBookingResult,
  clearPersistedIdempotencyKey,
  initialState,
  readPersistedBookingResult,
  resolveIdempotencyKey,
  writePersistedBookingResult,
  type PersistedBookingResult,
  type WizardState,
} from './state';

type Business = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  features: Record<string, boolean>;
  evidenceMinPhotos: number;
};

type Catalog = {
  zones: Array<{ id: string; name: string; color: string | null; description: string | null }>;
  vehicleTypes: Array<{ id: string; name: string; examples: string | null }>;
  packages: Array<{
    id: string;
    name: string;
    description: string | null;
    prices: Array<{ vehicleTypeId: string; priceCents: number; durationMinutes: number; isAvailable: boolean }>;
  }>;
  addons: Array<{
    id: string;
    name: string;
    description: string | null;
    pricingMode: string;
    basePriceCents: number;
    durationMinutes: number;
    defaultQuantity: number;
    maxQuantity: number;
  }>;
};

/**
 * 8-step wizard:
 *   1. Zone
 *   2. Date & time
 *   3. Vehicle (type + identity)
 *   4. Package
 *   5. Add-ons
 *   6. Customer
 *   7. Photos
 *   8. Review & pay
 */
export function BookingWizard({ business, catalog }: { business: Business; catalog: Catalog }) {
  const [state, setState] = useState<WizardState>(() =>
    initialState(resolveIdempotencyKey(business.slug)),
  );

  // If the customer already completed a booking in this session (and the
  // entry is still within its TTL), short-circuit the wizard and render the
  // success card directly. Phase 1: this is what prevents a refresh-after-
  // success from minting a new idempotency key and racing the customer's
  // own previously-committed appointment into a phantom SLOT_CONFLICT.
  const [persistedResult, setPersistedResult] = useState<PersistedBookingResult | null>(() =>
    readPersistedBookingResult(business.slug),
  );

  const photosStepEnabled = business.features.photos;
  const steps = [
    'zone',
    'datetime',
    'vehicle',
    'package',
    'addons',
    'customer',
    ...(photosStepEnabled ? ['photos'] : []),
    'review',
  ] as const;
  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx]!;
  const dateTimeStepIdx = steps.indexOf('datetime');

  const next = () => setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  const prev = () => setStepIdx((i) => Math.max(i - 1, 0));

  const onBookingSucceeded = useCallback(
    (result: Omit<PersistedBookingResult, 'completedAt'>) => {
      // Persist the success state in sessionStorage so a refresh on this
      // page re-renders the confirmation instead of restarting the wizard.
      writePersistedBookingResult(business.slug, result);
      setPersistedResult({ ...result, completedAt: Date.now() });
      // The idempotency key is intentionally NOT cleared here. A retry
      // before the customer clicks "Book another car wash" should keep
      // replaying the same successful response via the server's
      // idempotent-replay path.
    },
    [business.slug],
  );

  const onRestart = useCallback(() => {
    // Explicit "book another car wash". Clear both stores and reset the
    // wizard to a fresh attempt.
    clearPersistedBookingResult(business.slug);
    clearPersistedIdempotencyKey(business.slug);
    setPersistedResult(null);
    setState(initialState(resolveIdempotencyKey(business.slug)));
    setStepIdx(0);
  }, [business.slug]);

  const onPickAnotherTime = useCallback(() => {
    setState((s) => ({ ...s, startsAtISO: null }));
    if (dateTimeStepIdx >= 0) setStepIdx(dateTimeStepIdx);
  }, [dateTimeStepIdx]);

  // Branch A: a recent success exists — render the standalone confirmation.
  if (persistedResult) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">{business.name}</h1>
          <p className="mt-1 text-sm text-neutral-600">Your booking is in.</p>
        </header>
        <BookingSuccessCard
          business={business}
          appointmentId={persistedResult.appointmentId}
          depositMethod={persistedResult.depositMethod}
          depositAmountCents={persistedResult.depositAmountCents}
          clientSecret={null}
          onRestart={onRestart}
        />
      </main>
    );
  }

  // Branch B: standard wizard.
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{business.name}</h1>
          <span className="text-sm text-neutral-500">
            Step {stepIdx + 1} of {steps.length}
          </span>
        </div>
        <div className="mt-3 h-1 w-full rounded bg-neutral-200">
          <div
            className="h-1 rounded bg-[color:var(--brand)] transition-all"
            style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          />
        </div>
      </header>

      {step === 'zone' && (
        <StepZone
          zones={catalog.zones}
          value={state.zoneId}
          onChange={(zoneId) => setState({ ...state, zoneId })}
          onNext={next}
        />
      )}
      {step === 'datetime' && (
        <StepDateTime
          businessId={business.id}
          state={state}
          onChange={(patch) => setState({ ...state, ...patch })}
          onNext={next}
          onBack={prev}
        />
      )}
      {step === 'vehicle' && (
        <StepVehicle
          vehicleTypes={catalog.vehicleTypes}
          state={state}
          onChange={(patch) => setState({ ...state, ...patch })}
          onNext={next}
          onBack={prev}
        />
      )}
      {step === 'package' && (
        <StepPackage
          packages={catalog.packages}
          state={state}
          onChange={(patch) => setState({ ...state, ...patch })}
          onNext={next}
          onBack={prev}
        />
      )}
      {step === 'addons' && (
        <StepAddons
          addons={catalog.addons}
          state={state}
          onChange={(patch) => setState({ ...state, ...patch })}
          onNext={next}
          onBack={prev}
        />
      )}
      {step === 'customer' && (
        <StepCustomer
          businessId={business.id}
          state={state}
          onChange={(patch) => setState({ ...state, ...patch })}
          onNext={next}
          onBack={prev}
        />
      )}
      {step === 'photos' && (
        <StepPhotos
          businessId={business.id}
          state={state}
          onChange={(patch) => setState({ ...state, ...patch })}
          onNext={next}
          onBack={prev}
          minRequired={business.evidenceMinPhotos}
        />
      )}
      {step === 'review' && (
        <StepReviewPay
          business={business}
          state={state}
          onChange={(patch) => setState({ ...state, ...patch })}
          onBack={prev}
          onPickAnotherTime={onPickAnotherTime}
          onBookingSucceeded={onBookingSucceeded}
          onRestart={onRestart}
        />
      )}
    </main>
  );
}
