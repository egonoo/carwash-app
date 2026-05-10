'use client';

import { useRef, useState } from 'react';
import type { DetectedZoneInfo, WizardState } from './state';

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
  const lastZipRef = useRef<string | null>(null);

  function update<K extends keyof typeof c>(key: K, value: (typeof c)[K]) {
    onChange({ customer: { ...c, [key]: value } });
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

  const canContinue =
    !!c.email &&
    !!c.firstName &&
    !!c.phone &&
    !!c.addressLine1 &&
    !!c.addressCity &&
    !!c.addressState &&
    !!c.addressZip &&
    c.nonRefundableAccepted;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Your details</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name *" value={c.firstName ?? ''} onChange={(v) => update('firstName', v)} />
        <Field label="Last name" value={c.lastName ?? ''} onChange={(v) => update('lastName', v)} />
        <Field label="Email *" type="email" value={c.email ?? ''} onChange={(v) => update('email', v)} />
        <Field label="Phone *" value={c.phone ?? ''} onChange={(v) => update('phone', v)} placeholder="+13055551234" />
        <Field label="Address *" value={c.addressLine1 ?? ''} onChange={(v) => update('addressLine1', v)} />
        <Field label="Apt/Suite" value={c.addressLine2 ?? ''} onChange={(v) => update('addressLine2', v)} />
        <Field label="City *" value={c.addressCity ?? ''} onChange={(v) => update('addressCity', v)} />
        <Field label="State *" value={c.addressState ?? ''} onChange={(v) => update('addressState', v.toUpperCase())} />
        <div>
          <label className="label">ZIP *</label>
          <input
            type="text"
            className="input mt-1"
            value={c.addressZip ?? ''}
            onChange={(e) => update('addressZip', e.target.value)}
            onBlur={(e) => detectZone(e.target.value)}
          />
          <ZoneHint status={zoneStatus} detected={state.detectedZone} />
        </div>
      </div>
      <div>
        <label className="label">Special instructions</label>
        <textarea
          className="input mt-1"
          rows={2}
          value={c.instructions ?? ''}
          onChange={(e) => update('instructions', e.target.value)}
        />
      </div>

      <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={c.nonRefundableAccepted}
            onChange={(e) => update('nonRefundableAccepted', e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <strong>I understand the deposit is non-refundable</strong> (required).
          </span>
        </label>
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
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-primary" disabled={!canContinue} onClick={onNext}>
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
    return <p className="mt-1 text-xs text-danger">Could not detect service area. You can pick one above.</p>;
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
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
