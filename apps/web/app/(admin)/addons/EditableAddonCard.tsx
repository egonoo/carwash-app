'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAdminAddon } from '@/actions/catalog';

type PricingMode = 'fixed' | 'starting_at' | 'per_unit' | 'quote_on_site';

type Props = {
  addon: {
    id: string;
    name: string;
    pricingMode: PricingMode;
    basePriceCents: number;
    durationMinutes: number;
    isActive: boolean;
  };
};

const PRICING_OPTIONS: Array<{ value: PricingMode; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'starting_at', label: 'Starting at' },
  { value: 'per_unit', label: 'Per unit' },
  { value: 'quote_on_site', label: 'Quote on site' },
];

export function EditableAddonCard({ addon }: Props) {
  const router = useRouter();
  const [name, setName] = useState(addon.name);
  const [pricingMode, setPricingMode] = useState<PricingMode>(addon.pricingMode);
  const [priceDollars, setPriceDollars] = useState(
    (addon.basePriceCents / 100).toFixed(2),
  );
  const [durationMinutes, setDurationMinutes] = useState(addon.durationMinutes);
  const [isActive, setIsActive] = useState(addon.isActive);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isQuote = pricingMode === 'quote_on_site';

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSavedAt(null);
    startTransition(async () => {
      try {
        await updateAdminAddon({
          id: addon.id,
          name: name.trim(),
          pricingMode,
          basePriceCents: isQuote
            ? null
            : Math.max(0, Math.round(Number(priceDollars || 0) * 100)),
          durationMinutes: Math.max(0, Math.min(600, durationMinutes)),
          isActive,
        });
        setSavedAt(new Date().toLocaleTimeString());
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded border bg-white p-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <input
          required
          minLength={2}
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded border px-2 py-1 font-medium"
        />
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>
      </div>

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
            placeholder={isQuote ? 'Quoted' : ''}
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
          disabled={pending}
          className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        {savedAt && !err && (
          <span className="text-xs text-emerald-600">Saved at {savedAt}</span>
        )}
        {err && <span className="text-xs text-danger">{err}</span>}
      </div>
    </form>
  );
}
