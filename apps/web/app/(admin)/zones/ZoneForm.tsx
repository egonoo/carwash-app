'use client';

import { useState, useTransition } from 'react';
import { upsertZone } from '@/actions/zones';

export type ZoneFormValues = {
  id?: string;
  name: string;
  color: string;
  description: string;
  zipCodesText: string;
  isActive: boolean;
  travelTimeMinutes: string;
  extraFeeDollars: string;
  maxConcurrentJobs: string;
};

export function emptyZoneValues(): ZoneFormValues {
  return {
    name: '',
    color: '',
    description: '',
    zipCodesText: '',
    isActive: true,
    travelTimeMinutes: '',
    extraFeeDollars: '0',
    maxConcurrentJobs: '1',
  };
}

type Props = {
  initial: ZoneFormValues;
  onDone: () => void;
  onCancel: () => void;
};

export function ZoneForm({ initial, onDone, onCancel }: Props) {
  const [v, setV] = useState<ZoneFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const zipCodes = v.zipCodesText
      .split(/[\s,;]+/)
      .map((z) => z.trim())
      .filter(Boolean);

    const travel = v.travelTimeMinutes.trim() === '' ? null : Number(v.travelTimeMinutes);
    if (travel !== null && (!Number.isFinite(travel) || travel < 0)) {
      setError('Travel time must be a positive number or blank.');
      return;
    }

    const feeDollars = Number(v.extraFeeDollars);
    if (!Number.isFinite(feeDollars) || feeDollars < 0) {
      setError('Extra fee must be 0 or more.');
      return;
    }

    const maxJobs = Number(v.maxConcurrentJobs);
    if (!Number.isInteger(maxJobs) || maxJobs < 1) {
      setError('Max jobs at the same time must be 1 or more.');
      return;
    }

    startTransition(async () => {
      try {
        await upsertZone({
          id: v.id,
          name: v.name,
          color: v.color || undefined,
          description: v.description || undefined,
          zipCodes,
          isActive: v.isActive,
          travelTimeMinutes: travel,
          extraFeeCents: Math.round(feeDollars * 100),
          maxConcurrentJobs: maxJobs,
        });
        onDone();
      } catch (err: unknown) {
        const msg =
          (err as { details?: { message?: string }; message?: string })?.details?.message ??
          (err instanceof Error ? err.message : 'Failed to save zone');
        setError(msg);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded border bg-neutral-50 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <input
            type="text"
            required
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Active">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={v.isActive}
              onChange={(e) => setV({ ...v, isActive: e.target.checked })}
            />
            {v.isActive ? 'Active' : 'Inactive'}
          </label>
        </Field>
        <Field label="Travel time (minutes)" hint="blank = use business default">
          <input
            type="number"
            min={0}
            value={v.travelTimeMinutes}
            onChange={(e) => setV({ ...v, travelTimeMinutes: e.target.value })}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Extra fee ($)" hint="added to every booking in this zone">
          <input
            type="number"
            min={0}
            step="0.01"
            value={v.extraFeeDollars}
            onChange={(e) => setV({ ...v, extraFeeDollars: e.target.value })}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
        <Field
          label="Max jobs at the same time"
          required
          hint="how many appointments can run in parallel in this zone"
        >
          <input
            type="number"
            min={1}
            max={20}
            step={1}
            required
            value={v.maxConcurrentJobs}
            onChange={(e) => setV({ ...v, maxConcurrentJobs: e.target.value })}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Color" hint="optional, visual only (#rrggbb)">
          <input
            type="color"
            value={v.color || '#cccccc'}
            onChange={(e) => setV({ ...v, color: e.target.value })}
            className="h-8 w-16 rounded border"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          rows={2}
          value={v.description}
          onChange={(e) => setV({ ...v, description: e.target.value })}
          className="w-full rounded border px-2 py-1 text-sm"
        />
      </Field>

      <Field label="ZIP codes" hint="separated by comma, space or newline">
        <textarea
          rows={2}
          value={v.zipCodesText}
          onChange={(e) => setV({ ...v, zipCodesText: e.target.value })}
          placeholder="33101, 33102, 33109"
          className="w-full rounded border px-2 py-1 text-sm"
        />
      </Field>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : v.id ? 'Save changes' : 'Create zone'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-neutral-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-0.5 block text-[10px] text-neutral-500">{hint}</span>}
    </label>
  );
}
