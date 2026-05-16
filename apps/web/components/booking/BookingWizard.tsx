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
import {
  clearPersistedIdempotencyKey,
  initialState,
  resolveIdempotencyKey,
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

  const onBookingSucceeded = useCallback(() => {
    // Booking is durably committed server-side. Drop the persisted key so a
    // subsequent visit to /book starts a brand-new attempt instead of
    // replaying this one's idempotent response.
    clearPersistedIdempotencyKey(business.slug);
  }, [business.slug]);

  const onPickAnotherTime = useCallback(() => {
    setState((s) => ({ ...s, startsAtISO: null }));
    if (dateTimeStepIdx >= 0) setStepIdx(dateTimeStepIdx);
  }, [dateTimeStepIdx]);

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
        />
      )}
    </main>
  );
}
