'use client';

import { useMemo, useRef, useState } from 'react';
import {
  isE164,
  isEmail,
  isUSState,
  isZip,
  normalizePhoneE164,
} from '@/lib/booking-validation';
import type { DetectedZoneInfo, WizardState } from './state';

type FieldKey =
  | 'firstName'
  | 'email'
  | 'phone'
  | 'addressLine1'
  | 'addressCity'
  | 'addressState'
  | 'addressZip'
  | 'nonRefundableAccepted';

export function StepCustomer({
  businessId,
  state,
  onChange,
  onNext,
  onBack,
}: {
  businessId: string;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const c = state.customer;
  const [zoneStatus, setZoneStatus] = useState<'idle' | 'detecting' | 'error'>('idle');
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const lastZipRef = useRef<string | null>(null);

  function update<K extends keyof typeof c>(key: K, value: (typeof c)[K]) {
    onChange({ customer: { ...c, [key]: value } });
  }

  function markTouched(key: FieldKey) {
    setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  }

  async function detectZone(rawZip: string) {
    const zip = rawZip.trim().toUpperCase();
    if (!zip) return;
    if (lastZipRef.current === zip) return;
    lastZipRef.current = zip;
    setZoneStatus('detecting');
    try {
      const res = await fetch('/api/booking/detect-zone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessId, zip }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message ?? 'detect failed');
      const z: DetectedZoneInfo | null = json.data.zone;
      onChange({ zoneId: z?.id ?? null, detectedZone: z });
      setZoneStatus('idle');
    } catch {
      setZoneStatus('error');
    }
  }

  const errors = useMemo<Partial<Record<FieldKey, string>>>(() => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!c.firstName || c.firstName.trim().length < 1) e.firstName = 'First name is required.';
    if (!c.email || !isEmail(c.email)) e.email = 'Enter a valid email like name@example.com.';
    if (!c.phone) e.phone = 'Phone is required.';
    else if (!isE164(c.phone)) e.phone = 'Use a phone number with country code, e.g. +1 305 555 1234.';
    if (!c.addressLine1 || c.addressLine1.trim().length < 3) e.addressLine1 = 'Address is required.';
    if (!c.addressCity || c.addressCity.trim().length < 1) e.addressCity = 'City is required.';
    if (!c.addressState || !isUSState(c.addressState)) e.addressState = 'Use a 2-letter state, e.g. FL.';
    if (!c.addressZip || !isZip(c.addressZip)) e.addressZip = 'ZIP is required (3–12 characters).';
    if (!c.nonRefundableAccepted) e.nonRefundableAccepted = 'Please acknowledge the deposit is non-refundable.';
    return e;
  }, [
    c.firstName,
    c.email,
    c.phone,
    c.addressLine1,
    c.addressCity,
    c.addressState,
    c.addressZip,
    c.nonRefundableAccepted,
  ]);

  const canContinue = Object.keys(errors).length === 0;
  const showError = (k: FieldKey) => (touched[k] || submitAttempted) && errors[k];

  function handleContinue() {
    setSubmitAttempted(true);
    if (!canContinue) return;
    onNext();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Your details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="First name"
          required
          value={c.firstName ?? ''}
          onChange={(v) => update('firstName', v)}
          onBlur={() => markTouched('firstName')}
          error={showError('firstName') ? errors.firstName : undefined}
          autoComplete="given-name"
          maxLength={60}
        />
        <Field
          label="Last name"
          value={c.lastName ?? ''}
          onChange={(v) => update('lastName', v)}
          autoComplete="family-name"
          maxLength={60}
        />
        <Field
          label="Email"
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          value={c.email ?? ''}
          onChange={(v) => update('email', v.trim())}
          onBlur={() => markTouched('email')}
          placeholder="you@example.com"
          error={showError('email') ? errors.email : undefined}
        />
        <Field
          label="Phone"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={c.phone ?? ''}
          onChange={(v) => update('phone', v)}
          onBlur={(v) => {
            markTouched('phone');
            const normalized = normalizePhoneE164(v);
            if (normalized && normalized !== v) update('phone', normalized);
          }}
          placeholder="+1 305 555 1234"
          error={showError('phone') ? errors.phone : undefined}
          hint="We'll send the confirmation here and call only on arrival."
        />
        <Field
          label="Address"
          required
          value={c.addressLine1 ?? ''}
          onChange={(v) => update('addressLine1', v)}
          onBlur={() => markTouched('addressLine1')}
          autoComplete="address-line1"
          maxLength={200}
          error={showError('addressLine1') ? errors.addressLine1 : undefined}
        />
        <Field
          label="Apt / Suite"
          value={c.addressLine2 ?? ''}
          onChange={(v) => update('addressLine2', v)}
          autoComplete="address-line2"
          maxLength={100}
        />
        <Field
          label="City"
          required
          value={c.addressCity ?? ''}
          onChange={(v) => update('addressCity', v)}
          onBlur={() => markTouched('addressCity')}
          autoComplete="address-level2"
          maxLength={80}
          error={showError('addressCity') ? errors.addressCity : undefined}
        />
        <Field
          label="State"
          required
          value={c.addressState ?? ''}
          onChange={(v) =>
            update(
              'addressState',
              v
                .normalize('NFD')
                .replace(/[^A-Za-z]/g, '')
                .slice(0, 2)
                .toUpperCase(),
            )
          }
          onBlur={() => markTouched('addressState')}
          autoCapitalize="characters"
          autoComplete="address-level1"
          maxLength={2}
          placeholder="FL"
          error={showError('addressState') ? errors.addressState : undefined}
        />
        <div>
          <label className="label">
            ZIP <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={12}
            className={`input mt-1 ${showError('addressZip') ? 'border-danger focus:border-danger' : ''}`}
            value={c.addressZip ?? ''}
            onChange={(e) => update('addressZip', e.target.value)}
            onBlur={(e) => {
              markTouched('addressZip');
              detectZone(e.target.value);
            }}
            aria-invalid={showError('addressZip') ? true : undefined}
          />
          {showError('addressZip') ? (
            <p className="mt-1 text-xs text-danger">{errors.addressZip}</p>
          ) : (
            <ZoneHint status={zoneStatus} detected={state.detectedZone} />
          )}
        </div>
      </div>
      <div>
        <label className="label">Special instructions</label>
        <textarea
          className="input mt-1"
          rows={2}
          maxLength={500}
          value={c.instructions ?? ''}
          onChange={(e) => update('instructions', e.target.value)}
          placeholder="Gate code, parking notes, anything we should know."
        />
      </div>

      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={c.nonRefundableAccepted}
            onChange={(e) => {
              markTouched('nonRefundableAccepted');
              update('nonRefundableAccepted', e.target.checked);
            }}
            className="mt-0.5 h-4 w-4"
            aria-invalid={showError('nonRefundableAccepted') ? true : undefined}
          />
          <span>
            <strong>I understand the deposit is non-refundable</strong> (required).
          </span>
        </label>
        {showError('nonRefundableAccepted') && (
          <p className="ml-6 text-xs text-danger">{errors.nonRefundableAccepted}</p>
        )}
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={c.marketingConsent}
            onChange={(e) => update('marketingConsent', e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>Send me updates and promotions.</span>
        </label>
      </div>

      <div className="flex justify-between">
        <button type="button" className="btn-ghost" onClick={onBack}>Back</button>
        <button
          type="button"
          className="btn-primary"
          disabled={!canContinue && submitAttempted}
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </section>
  );
}

function ZoneHint({
  status,
  detected,
}: {
  status: 'idle' | 'detecting' | 'error';
  detected: DetectedZoneInfo | null;
}) {
  if (status === 'detecting') {
    return <p className="mt-1 text-xs text-neutral-500">Detecting service area…</p>;
  }
  if (status === 'error') {
    return <p className="mt-1 text-xs text-danger">Could not detect service area. You can pick one earlier.</p>;
  }
  if (!detected) return null;
  return (
    <p className="mt-1 text-xs text-neutral-600">
      Service area: <strong>{detected.name}</strong>
      {detected.matchedBy === 'fallback' && ' (default)'}
      {detected.extraFeeCents > 0 && (
        <> — extra fee ${(detected.extraFeeCents / 100).toFixed(2)}</>
      )}
    </p>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  onBlur,
  type = 'text',
  inputMode,
  autoCapitalize,
  autoComplete,
  placeholder,
  maxLength,
  error,
  hint,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (val: string) => void;
  onBlur?: (val: string) => void;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'search' | 'url';
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className={`input mt-1 ${error ? 'border-danger focus:border-danger' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur?.(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  );
}
