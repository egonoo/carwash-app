'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAppointmentItems } from '@/actions/admin-appointment-items';

type PackageOption = { id: string; name: string };
type AddonOption = { id: string; name: string };

type Props = {
  appointmentId: string;
  packages: PackageOption[];
  addons: AddonOption[];
  initialPackageId: string | null;
  initialAddons: Array<{ addonId: string; quantity: number }>;
};

export function ItemsEditor(props: Props) {
  const router = useRouter();
  const [packageId, setPackageId] = useState<string>(props.initialPackageId ?? '');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>(() =>
    Object.fromEntries(props.initialAddons.map((a) => [a.addonId, a.quantity])),
  );
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleAddon(id: string, checked: boolean) {
    setSelectedAddons((prev) => {
      const next = { ...prev };
      if (checked) next[id] = next[id] ?? 1;
      else delete next[id];
      return next;
    });
  }

  function setAddonQty(id: string, qty: number) {
    setSelectedAddons((prev) => ({ ...prev, [id]: Math.max(1, Math.min(50, qty)) }));
  }

  function submit() {
    if (!packageId) {
      setErr('Select a package');
      return;
    }
    setErr(null);
    startTransition(async () => {
      try {
        await setAppointmentItems({
          appointmentId: props.appointmentId,
          packageId,
          addons: Object.entries(selectedAddons).map(([addonId, quantity]) => ({
            addonId,
            quantity,
          })),
        });
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Package</label>
        <select
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
        >
          <option value="">Select a package…</option>
          {props.packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="text-sm font-medium">Add-ons</div>
        {props.addons.length === 0 ? (
          <p className="mt-1 text-xs text-neutral-500">No add-ons configured.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {props.addons.map((a) => {
              const isSelected = a.id in selectedAddons;
              return (
                <li key={a.id} className="flex items-center gap-3">
                  <input
                    id={`addon-${a.id}`}
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => toggleAddon(a.id, e.target.checked)}
                  />
                  <label htmlFor={`addon-${a.id}`} className="flex-1 text-sm">
                    {a.name}
                  </label>
                  {isSelected && (
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={selectedAddons[a.id]}
                      onChange={(e) => setAddonQty(a.id, Number(e.target.value))}
                      className="w-20 rounded border px-2 py-1 text-sm"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          onClick={submit}
          disabled={pending}
        >
          {pending ? 'Saving…' : 'Save items & recompute totals'}
        </button>
        {err && <span className="text-sm text-danger">{err}</span>}
      </div>
    </div>
  );
}
