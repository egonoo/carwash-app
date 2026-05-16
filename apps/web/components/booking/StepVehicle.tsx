'use client';

import { useMemo, useState } from 'react';
import { isPlateState, isYear, normalizePlate, normalizePlateState } from '@/lib/booking-validation';
import type { WizardState } from './state';

export function StepVehicle({
  vehicleTypes,
  state,
  onChange,
  onNext,
  onBack,
}: {
  vehicleTypes: Array<{ id: string; name: string; examples: string | null }>;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const v = state.vehicle;
  const [touched, setTouched] = useState<{ year?: boolean; plateState?: boolean }>({});

  const errors = useMemo(() => {
    const e: { year?: string; plateState?: string; type?: string } = {};
    if (!state.vehicleTypeId) e.type = 'Pick the size that best matches your vehicle.';
    if (v.year !== undefined && !isYear(v.year)) {
      e.year = 'Use a 4-digit year between 1900 and 2100.';
    }
    if (v.plateState && !isPlateState(v.plateState)) {
      e.plateState = 'Use a 2-letter state code (e.g. FL).';
    }
    return e;
  }, [state.vehicleTypeId, v.year, v.plateState]);

  const canContinue = !errors.type && !errors.year && !errors.plateState;

  function handleYearChange(raw: string) {
    setTouched((t) => ({ ...t, year: true }));
    const trimmed = raw.trim();
    if (trimmed === '') {
      onChange({ vehicle: { ...v, year: undefined } });
      return;
    }
    const n = Number(trimmed.replace(/\D/g, '').slice(0, 4));
    onChange({ vehicle: { ...v, year: Number.isFinite(n) && n > 0 ? n : undefined } });
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What are we washing?</h2>
        <p className="text-sm text-neutral-600">Pick the size that matches your vehicle.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {vehicleTypes.map((vt) => (
            <button
              key={vt.id}
              type="button"
              onClick={() => onChange({ vehicleTypeId: vt.id })}
              className={`card text-left transition ${
                state.vehicleTypeId === vt.id ? 'ring-2 ring-[color:var(--brand)]' : 'hover:bg-neutral-50'
              }`}
            >
              <div className="font-semibold">{vt.name}</div>
              {vt.examples && <div className="mt-1 text-xs text-neutral-500">{vt.examples}</div>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Tell us about your car (optional but helps)</h3>
        <p className="mt-1 text-xs text-neutral-500">
          We'll save these details so next time is faster. Plate is optional.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            label="Make"
            value={v.make ?? ''}
            onChange={(val) => onChange({ vehicle: { ...v, make: val } })}
            placeholder="Honda"
            maxLength={50}
          />
          <Input
            label="Model"
            value={v.model ?? ''}
            onChange={(val) => onChange({ vehicle: { ...v, model: val } })}
            placeholder="Civic"
            maxLength={50}
          />
          <Input
            label="Year"
            value={v.year?.toString() ?? ''}
            onChange={handleYearChange}
            placeholder="2020"
            inputMode="numeric"
            maxLength={4}
            error={touched.year ? errors.year : undefined}
          />
          <Input
            label="Color"
            value={v.color ?? ''}
            onChange={(val) => onChange({ vehicle: { ...v, color: val } })}
            placeholder="Blue"
            maxLength={30}
          />
          <Input
            label="Plate (optional)"
            value={v.plate ?? ''}
            onChange={(val) => onChange({ vehicle: { ...v, plate: normalizePlate(val) } })}
            placeholder="ABC1234"
            autoCapitalize="characters"
          />
          <Input
            label="Plate state"
            value={v.plateState ?? ''}
            onChange={(val) => {
              setTouched((t) => ({ ...t, plateState: true }));
              onChange({ vehicle: { ...v, plateState: normalizePlateState(val) } });
            }}
            placeholder="FL"
            autoCapitalize="characters"
            maxLength={2}
            error={touched.plateState ? errors.plateState : undefined}
          />
        </div>
      </div>

      {errors.type && <p className="text-sm text-danger">{errors.type}</p>}

      <div className="flex justify-between">
        <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
        <button type="button" className="btn-primary" disabled={!canContinue} onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  autoCapitalize,
  maxLength,
  error,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'search' | 'url';
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  error?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        className={`input mt-1 ${error ? 'border-danger focus:border-danger' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
