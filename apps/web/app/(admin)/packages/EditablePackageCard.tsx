'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveAdminPackage } from '@/actions/catalog';

type PriceRow = {
  vehicleTypeId: string;
  vehicleTypeName: string;
  priceCents: number;
  durationMinutes: number;
  isAvailable: boolean;
};

type Props = {
  pkg: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    prices: PriceRow[];
  };
};

export function EditablePackageCard({ pkg }: Props) {
  const router = useRouter();
  const [name, setName] = useState(pkg.name);
  const [description, setDescription] = useState(pkg.description ?? '');
  const [isActive, setIsActive] = useState(pkg.isActive);
  const [prices, setPrices] = useState<PriceRow[]>(pkg.prices);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updatePrice<K extends keyof PriceRow>(idx: number, key: K, value: PriceRow[K]) {
    setPrices((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSavedAt(null);
    startTransition(async () => {
      try {
        await saveAdminPackage({
          packageId: pkg.id,
          name: name.trim(),
          description: description.trim() ? description.trim() : null,
          isActive,
          prices: prices.map((p) => ({
            vehicleTypeId: p.vehicleTypeId,
            priceCents: p.priceCents,
            durationMinutes: p.durationMinutes,
            isAvailable: p.isAvailable,
          })),
        });
        setSavedAt(new Date().toLocaleTimeString());
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded border bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={100}
          className="flex-1 rounded border px-2 py-1 font-semibold"
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

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="Description"
        className="w-full rounded border px-2 py-1 text-sm"
      />

      <div className="space-y-2">
        <div className="text-xs font-medium text-neutral-500">Per vehicle type</div>
        {prices.length === 0 ? (
          <p className="text-xs text-neutral-500">
            No prices configured for this package yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr>
                <th className="py-1">Vehicle type</th>
                <th>Price ($)</th>
                <th>Duration (min)</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p, i) => (
                <tr key={p.vehicleTypeId} className="border-t">
                  <td className="py-1 pr-2">{p.vehicleTypeName}</td>
                  <td className="pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={(p.priceCents / 100).toFixed(2)}
                      onChange={(e) =>
                        updatePrice(
                          i,
                          'priceCents',
                          Math.max(0, Math.round(Number(e.target.value || 0) * 100)),
                        )
                      }
                      className="w-24 rounded border px-2 py-1"
                    />
                  </td>
                  <td className="pr-2">
                    <input
                      type="number"
                      min={1}
                      max={960}
                      value={p.durationMinutes}
                      onChange={(e) =>
                        updatePrice(
                          i,
                          'durationMinutes',
                          Math.max(1, Math.min(960, Number(e.target.value || 0))),
                        )
                      }
                      className="w-24 rounded border px-2 py-1"
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={p.isAvailable}
                      onChange={(e) => updatePrice(i, 'isAvailable', e.target.checked)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
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
