'use client';

import { Fragment, useState, useTransition } from 'react';
import { ZoneForm, emptyZoneValues, type ZoneFormValues } from './ZoneForm';
import { toggleZoneActive, deleteZone } from '@/actions/zones';

export type ZoneRow = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
  zipCodes: string[];
  isActive: boolean;
  travelTimeMinutes: number | null;
  extraFeeCents: number;
  maxConcurrentJobs: number;
  displayOrder: number;
  appointmentCount: number;
};

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; id: string };

export function ZonesManager({
  zones,
  defaultTravelTimeMin,
}: {
  zones: ZoneRow[];
  defaultTravelTimeMin: number;
}) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [rowError, setRowError] = useState<Record<string, string | null>>({});
  const [isPending, startTransition] = useTransition();

  function editValues(z: ZoneRow): ZoneFormValues {
    return {
      id: z.id,
      name: z.name,
      color: z.color ?? '',
      description: z.description ?? '',
      zipCodesText: z.zipCodes.join(', '),
      isActive: z.isActive,
      travelTimeMinutes: z.travelTimeMinutes == null ? '' : String(z.travelTimeMinutes),
      extraFeeDollars: (z.extraFeeCents / 100).toFixed(2),
      maxConcurrentJobs: String(z.maxConcurrentJobs),
    };
  }

  function onToggle(z: ZoneRow) {
    setRowError({ ...rowError, [z.id]: null });
    startTransition(async () => {
      try {
        await toggleZoneActive({ id: z.id, isActive: !z.isActive });
      } catch (err) {
        setRowError({
          ...rowError,
          [z.id]: err instanceof Error ? err.message : 'Failed to toggle',
        });
      }
    });
  }

  function onDelete(z: ZoneRow) {
    if (z.appointmentCount > 0) {
      setRowError({
        ...rowError,
        [z.id]: `Has ${z.appointmentCount} appointment(s). Deactivate instead.`,
      });
      return;
    }
    if (!confirm(`Delete zone "${z.name}"? This cannot be undone.`)) return;
    setRowError({ ...rowError, [z.id]: null });
    startTransition(async () => {
      try {
        await deleteZone({ id: z.id });
      } catch (err: unknown) {
        const msg =
          (err as { details?: { message?: string }; message?: string })?.details?.message ??
          (err instanceof Error ? err.message : 'Failed to delete');
        setRowError({ ...rowError, [z.id]: msg });
      }
    });
  }

  return (
    <div className="space-y-4">
      {mode.kind === 'list' && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setMode({ kind: 'create' })}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add zone
          </button>
        </div>
      )}

      {mode.kind === 'create' && (
        <ZoneForm
          initial={emptyZoneValues()}
          onDone={() => setMode({ kind: 'list' })}
          onCancel={() => setMode({ kind: 'list' })}
        />
      )}

      {zones.length === 0 && mode.kind === 'list' && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-500">
          No zones configured yet.
        </div>
      )}

      {zones.length > 0 && (
        <div className="overflow-hidden rounded border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">ZIP codes</th>
                <th className="px-3 py-2">Travel</th>
                <th className="px-3 py-2">Extra fee</th>
                <th className="px-3 py-2">Max jobs</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <Fragment key={z.id}>
                  <tr className="border-t">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {z.color && (
                          <span
                            className="h-3 w-3 rounded-full border"
                            style={{ backgroundColor: z.color }}
                          />
                        )}
                        <div>
                          <div className="font-medium">{z.name}</div>
                          <div className="text-xs text-neutral-500">{z.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          z.isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {z.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-600">
                      {z.zipCodes.length === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : z.zipCodes.length <= 4 ? (
                        z.zipCodes.join(', ')
                      ) : (
                        `${z.zipCodes.slice(0, 4).join(', ')} +${z.zipCodes.length - 4}`
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {z.travelTimeMinutes == null ? (
                        <span className="text-neutral-400">{defaultTravelTimeMin} min (default)</span>
                      ) : (
                        `${z.travelTimeMinutes} min`
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {z.extraFeeCents === 0 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        `$${(z.extraFeeCents / 100).toFixed(2)}`
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{z.maxConcurrentJobs}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMode({ kind: 'edit', id: z.id })}
                          className="rounded border px-2 py-1 text-xs hover:bg-neutral-100"
                          disabled={isPending}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggle(z)}
                          className="rounded border px-2 py-1 text-xs hover:bg-neutral-100"
                          disabled={isPending}
                        >
                          {z.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(z)}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                          disabled={isPending || z.appointmentCount > 0}
                          title={
                            z.appointmentCount > 0
                              ? `Has ${z.appointmentCount} appointments`
                              : 'Delete zone'
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {rowError[z.id] && (
                    <tr className="border-t bg-red-50">
                      <td colSpan={7} className="px-3 py-1 text-xs text-red-700">
                        {rowError[z.id]}
                      </td>
                    </tr>
                  )}
                  {mode.kind === 'edit' && mode.id === z.id && (
                    <tr className="border-t">
                      <td colSpan={7} className="p-3">
                        <ZoneForm
                          initial={editValues(z)}
                          onDone={() => setMode({ kind: 'list' })}
                          onCancel={() => setMode({ kind: 'list' })}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
