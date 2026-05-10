'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createAdminAddon } from '@/actions/catalog';

type PricingMode = 'fixed' | 'starting_at' | 'per_unit' | 'quote_on_site';

const PRICING_OPTIONS: Array<{ value: PricingMode; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'starting_at', label: 'Starting at' },
  { value: 'per_unit', label: 'Per unit' },
  { value: 'quote_on_site', label: 'Quote on site' },
];

const INITIAL = {
  name: '',
  pricingMode: 'fixed' as PricingMode,
  priceDollars: '',
  durationMinutes: 30,
  isActive: true,
};

export function NewAddonForm() {
  const router = useRouter();
  const [name, setName] = useState(INITIAL.name);
  const [pricingMode, setPricingMode] = useState<PricingMode>(INITIAL.pricingMode);
  const [priceDollars, setPriceDollars] = useState(INITIAL.priceDollars);
  const [durationMinutes, setDurationMinutes] = useState(INITIAL.durationMinutes);
  const [isActive, setIsActive] = useState(INITIAL.isActive);
  const [err, setErr] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isQuote = pricingMode === 'quote_on_site';

  function reset() {
    setName(INITIAL.name);
    setPricingMode(INITIAL.pricingMode);
    setPriceDollars(INITIAL.priceDollars);
    setDurationMinutes(INITIAL.durationMinutes);
    setIsActive(INITIAL.isActive);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setCreatedAt(null);
    startTransition(async () => {
      try {
        await createAdminAddon({
          name: name.trim(),
          pricingMode,
          basePriceCents: isQuote
            ? null
            : Math.max(0, Math.round(Number(priceDollars || 0) * 100)),
          durationMinutes: Math.max(0, Math.min(600, durationMinutes)),
          isActive,
        });
        setCreatedAt(new Date().toLocaleTimeString());
        reset();
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded border border-dashed bg-white p-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">New add-on</h3>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-xs text-neutral-500">Name</span>
        <input
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-xs text-neutral-500">Pricing</span>
          <select
            value={pricingMode}
            onChange={(e) => setPricingMode(e.target.value as PricingMode)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {PRICING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs text-neutral-500">Price ($)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={isQuote ? '' : priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            disabled={isQuote}
            placeholder={isQuote ? 'Quoted' : '0.00'}
            className="mt-1 w-full rounded border px-2 py-1 disabled:bg-neutral-100"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs text-neutral-500">Duration (min)</span>
          <input
            type="number"
            min={0}
            max={600}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value || 0))}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || name.trim().length < 2}
          className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? 'Creating…' : 'Create add-on'}
        </button>
        {createdAt && !err && (
          <span className="text-xs text-emerald-600">Created at {createdAt}</span>
        )}
        {err && <span className="text-xs text-danger">{err}</span>}
      </div>
    </form>
  );
}
