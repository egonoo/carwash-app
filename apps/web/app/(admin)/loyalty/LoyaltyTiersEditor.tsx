'use client';

import { useState, useTransition } from 'react';
import { upsertLoyaltyTier, deleteLoyaltyTier } from '@/actions/loyalty';

type DiscountType = 'percentage' | 'fixed';
type Mode = 'fixed' | 'percentage' | 'free';

type Tier = {
  id: string;
  name: string | null;
  visitsRequired: number;
  discountType: DiscountType;
  discountValue: number;
  appliesToPackageIds: string[];
  maxRedemptionsPerVehicle: number;
  displayOrder: number;
  isActive: boolean;
};

type PackageOption = { id: string; name: string; samplePriceCents: number | null };

type Preset = {
  label: string;
  visits: number;
  mode: Mode;
  // Display value: dollars for fixed, percent for percentage; ignored for free
  displayValue: number;
};

const PRESETS: Preset[] = [
  { label: '5 visits → $10 OFF', visits: 5, mode: 'fixed', displayValue: 10 },
  { label: '10 visits → 15% OFF', visits: 10, mode: 'percentage', displayValue: 15 },
  { label: '5th wash FREE', visits: 5, mode: 'free', displayValue: 0 },
];

function tmpId() {
  return `tmp-${Math.random().toString(36).slice(2, 8)}`;
}

function modeOf(t: { discountType: DiscountType; discountValue: number }): Mode {
  if (t.discountType === 'percentage' && t.discountValue >= 10000) return 'free';
  return t.discountType;
}

function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

function percentFromBps(bps: number): string {
  return (bps / 100).toString();
}

function previewLine(
  mode: Mode,
  displayValue: number,
  pkg: PackageOption | undefined,
): string | null {
  if (!pkg || pkg.samplePriceCents == null) return null;
  const price = pkg.samplePriceCents;
  if (mode === 'free') return `${pkg.name} ($${dollarsFromCents(price)}) → FREE`;
  if (mode === 'fixed') {
    const cents = Math.round(displayValue * 100);
    const after = Math.max(0, price - cents);
    return `${pkg.name} ($${dollarsFromCents(price)}) → pays $${dollarsFromCents(after)}`;
  }
  // percentage
  const pct = Math.max(0, Math.min(100, displayValue));
  const after = Math.max(0, Math.round(price * (1 - pct / 100)));
  return `${pkg.name} ($${dollarsFromCents(price)}) → pays $${dollarsFromCents(after)}`;
}

function tierFromPreset(p: Preset, displayOrder: number): Tier {
  if (p.mode === 'free') {
    return {
      id: tmpId(),
      name: null,
      visitsRequired: p.visits,
      discountType: 'percentage',
      discountValue: 10000,
      appliesToPackageIds: [],
      maxRedemptionsPerVehicle: 1,
      displayOrder,
      isActive: true,
    };
  }
  if (p.mode === 'fixed') {
    return {
      id: tmpId(),
      name: null,
      visitsRequired: p.visits,
      discountType: 'fixed',
      discountValue: Math.round(p.displayValue * 100),
      appliesToPackageIds: [],
      maxRedemptionsPerVehicle: 1,
      displayOrder,
      isActive: true,
    };
  }
  return {
    id: tmpId(),
    name: null,
    visitsRequired: p.visits,
    discountType: 'percentage',
    discountValue: Math.round(p.displayValue * 100),
    appliesToPackageIds: [],
    maxRedemptionsPerVehicle: 1,
    displayOrder,
    isActive: true,
  };
}

export function LoyaltyTiersEditor({
  tiers,
  packages,
}: {
  tiers: Tier[];
  packages: PackageOption[];
}) {
  const [rows, setRows] = useState<Tier[]>(tiers);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [errs, setErrs] = useState<Record<string, string | null>>({});
  const [pending, startTransition] = useTransition();

  function patch(id: string, p: Partial<Tier>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  async function persist(tier: Tier): Promise<{ ok: true; id: string } | null> {
    try {
      const res = await upsertLoyaltyTier({
        id: tier.id.startsWith('tmp-') ? undefined : tier.id,
        visitsRequired: tier.visitsRequired,
        discountType: tier.discountType,
        discountValue: tier.discountValue,
        appliesToPackageIds: tier.appliesToPackageIds,
        maxRedemptionsPerVehicle: tier.maxRedemptionsPerVehicle,
        displayOrder: tier.displayOrder,
        name: tier.name ?? undefined,
        isActive: tier.isActive,
      });
      return res;
    } catch (e) {
      setErrs((prev) => ({ ...prev, [tier.id]: (e as Error).message }));
      return null;
    }
  }

  function saveRow(id: string) {
    const tier = rows.find((r) => r.id === id);
    if (!tier) return;
    setErrs((prev) => ({ ...prev, [id]: null }));
    startTransition(async () => {
      const res = await persist(tier);
      if (res) {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, id: res.id } : r)));
        setSavedAt((prev) => ({ ...prev, [res.id]: Date.now() }));
      }
    });
  }

  function removeRow(id: string) {
    const tier = rows.find((r) => r.id === id);
    if (!tier) return;
    if (tier.id.startsWith('tmp-')) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      return;
    }
    startTransition(async () => {
      try {
        await deleteLoyaltyTier(tier.id);
        setRows((prev) => prev.filter((r) => r.id !== id));
      } catch (e) {
        setErrs((prev) => ({ ...prev, [id]: (e as Error).message }));
      }
    });
  }

  function addEmpty() {
    const next = rows.length;
    setRows((prev) => [
      ...prev,
      {
        id: tmpId(),
        name: null,
        visitsRequired: 5 * (next + 1),
        discountType: 'fixed',
        discountValue: 1000,
        appliesToPackageIds: [],
        maxRedemptionsPerVehicle: 1,
        displayOrder: next,
        isActive: true,
      },
    ]);
  }

  function applyPreset(p: Preset) {
    const tier = tierFromPreset(p, rows.length);
    setRows((prev) => [...prev, tier]);
    startTransition(async () => {
      const res = await persist(tier);
      if (res) {
        setRows((prev) => prev.map((r) => (r.id === tier.id ? { ...r, id: res.id } : r)));
        setSavedAt((prev) => ({ ...prev, [res.id]: Date.now() }));
      }
    });
  }

  function setMode(id: string, mode: Mode) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    if (mode === 'free') {
      patch(id, { discountType: 'percentage', discountValue: 10000 });
      return;
    }
    if (mode === 'fixed') {
      // If switching from free or percentage, default to $10
      const wasFixed = row.discountType === 'fixed' && row.discountValue < 100000;
      patch(id, {
        discountType: 'fixed',
        discountValue: wasFixed ? row.discountValue : 1000,
      });
      return;
    }
    // percentage
    const wasPercent =
      row.discountType === 'percentage' && row.discountValue > 0 && row.discountValue < 10000;
    patch(id, {
      discountType: 'percentage',
      discountValue: wasPercent ? row.discountValue : 1500,
    });
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Quick setup</h2>
        <p className="text-xs text-neutral-500">
          Click a preset to add a reward tier. You can edit it after.
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              disabled={pending}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-60"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reward tiers</h2>
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            onClick={addEmpty}
            disabled={pending}
          >
            + Add tier
          </button>
        </div>

        {rows.length === 0 && (
          <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-500">
            No tiers yet. Use a quick-setup preset above or add one manually.
          </div>
        )}

        <div className="space-y-4">
          {rows.map((row) => {
            const mode = modeOf(row);
            const displayValue =
              mode === 'fixed'
                ? Number(dollarsFromCents(row.discountValue))
                : mode === 'percentage'
                  ? Number(percentFromBps(row.discountValue))
                  : 0;
            const previewPkg =
              row.appliesToPackageIds.length > 0
                ? packages.find((p) => p.id === row.appliesToPackageIds[0]) ?? packages[0]
                : packages[0];
            const preview = previewLine(mode, displayValue, previewPkg);
            const ts = savedAt[row.id];
            const err = errs[row.id];

            return (
              <article
                key={row.id}
                className="rounded-lg border bg-white p-4 shadow-sm"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-neutral-500">
                      After how many visits
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-neutral-600">After</span>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={row.visitsRequired}
                        onChange={(e) =>
                          patch(row.id, {
                            visitsRequired: Math.max(1, Number(e.target.value || 1)),
                          })
                        }
                        className="w-20 rounded border px-2 py-1 text-sm"
                      />
                      <span className="text-sm text-neutral-600">visits</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-500">Reward</label>
                    <div className="mt-1 inline-flex overflow-hidden rounded border">
                      <ToggleBtn
                        label="$ OFF"
                        active={mode === 'fixed'}
                        onClick={() => setMode(row.id, 'fixed')}
                      />
                      <ToggleBtn
                        label="% OFF"
                        active={mode === 'percentage'}
                        onClick={() => setMode(row.id, 'percentage')}
                      />
                      <ToggleBtn
                        label="FREE SERVICE"
                        active={mode === 'free'}
                        onClick={() => setMode(row.id, 'free')}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {mode === 'fixed' && (
                        <>
                          <span className="text-sm text-neutral-600">$</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={dollarsFromCents(row.discountValue)}
                            onChange={(e) =>
                              patch(row.id, {
                                discountValue: Math.max(
                                  1,
                                  Math.round(Number(e.target.value || 0) * 100),
                                ),
                              })
                            }
                            className="w-28 rounded border px-2 py-1 text-sm"
                          />
                          <span className="text-xs text-neutral-500">off</span>
                        </>
                      )}
                      {mode === 'percentage' && (
                        <>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            step={1}
                            value={percentFromBps(row.discountValue)}
                            onChange={(e) =>
                              patch(row.id, {
                                discountValue: Math.max(
                                  1,
                                  Math.min(10000, Math.round(Number(e.target.value || 0) * 100)),
                                ),
                              })
                            }
                            className="w-24 rounded border px-2 py-1 text-sm"
                          />
                          <span className="text-sm text-neutral-600">%</span>
                          <span className="text-xs text-neutral-500">off</span>
                        </>
                      )}
                      {mode === 'free' && (
                        <span className="text-sm text-neutral-500">
                          Customer pays $0 for this service.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-neutral-500">
                      Applies to packages{' '}
                      <span className="text-neutral-400">(empty = all packages)</span>
                    </label>
                    <select
                      multiple
                      size={Math.min(4, Math.max(2, packages.length))}
                      value={row.appliesToPackageIds}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions).map(
                          (o) => o.value,
                        );
                        patch(row.id, { appliesToPackageIds: values });
                      }}
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    >
                      {packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-500">
                      Limit per vehicle
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={row.maxRedemptionsPerVehicle}
                      onChange={(e) =>
                        patch(row.id, {
                          maxRedemptionsPerVehicle: Math.max(1, Number(e.target.value || 1)),
                        })
                      }
                      className="mt-1 w-24 rounded border px-2 py-1 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-500">Active</label>
                    <div className="mt-1">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={row.isActive}
                          onChange={(e) => patch(row.id, { isActive: e.target.checked })}
                        />
                        {row.isActive ? 'Active' : 'Hidden'}
                      </label>
                    </div>
                  </div>
                </div>

                {preview && (
                  <div className="mt-4 rounded bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Preview
                    </span>
                    <div className="mt-0.5">{preview}</div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
                  <button
                    type="button"
                    onClick={() => saveRow(row.id)}
                    disabled={pending}
                    className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    {pending ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={pending}
                    className="rounded border px-3 py-2 text-sm hover:bg-neutral-50"
                  >
                    Remove
                  </button>
                  {ts && !err && (
                    <span className="text-xs text-emerald-600">
                      ✓ Saved at {new Date(ts).toLocaleTimeString()}
                    </span>
                  )}
                  {err && <span className="text-xs text-red-600">{err}</span>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ToggleBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium ${
        active
          ? 'bg-black text-white'
          : 'bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {label}
    </button>
  );
}
