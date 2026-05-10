'use client';

import { useState, useTransition } from 'react';
import { saveWorkingHours } from '@/actions/availability';

type DayState = {
  dayOfWeek: number;
  enabled: boolean;
  start: string;
  end: string;
};

export type WorkingHoursInitial = { days: DayState[] };

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function WorkingHoursForm({ initial }: { initial: WorkingHoursInitial }) {
  const [days, setDays] = useState<DayState[]>(initial.days);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(idx: number, patch: Partial<DayState>) {
    const next = days.slice();
    next[idx] = { ...next[idx]!, ...patch };
    setDays(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    for (const d of days) {
      if (d.enabled && d.start >= d.end) {
        setError(`${DAY_LABELS[d.dayOfWeek]}: end time must be after start time.`);
        return;
      }
    }

    startTransition(async () => {
      try {
        await saveWorkingHours({
          days: days.map((d) => ({
            dayOfWeek: d.dayOfWeek,
            enabled: d.enabled,
            start: d.enabled ? d.start : undefined,
            end: d.enabled ? d.end : undefined,
          })),
        });
        setSavedAt(Date.now());
      } catch (err: unknown) {
        const msg =
          (err as { details?: { message?: string }; message?: string })?.details?.message ??
          (err instanceof Error ? err.message : 'Failed to save');
        setError(msg);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="overflow-hidden rounded border">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2">Open</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.dayOfWeek} className="border-t">
                <td className="px-3 py-2 font-medium">{DAY_LABELS[d.dayOfWeek]}</td>
                <td className="px-3 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => update(i, { enabled: e.target.checked })}
                    />
                    <span className="text-xs text-neutral-600">
                      {d.enabled ? 'Open' : 'Closed'}
                    </span>
                  </label>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="time"
                    value={d.start}
                    disabled={!d.enabled}
                    onChange={(e) => update(i, { start: e.target.value })}
                    className="rounded border px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="time"
                    value={d.end}
                    disabled={!d.enabled}
                    onChange={(e) => update(i, { end: e.target.value })}
                    className="rounded border px-2 py-1 text-sm disabled:bg-neutral-100 disabled:text-neutral-400"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {savedAt && !error && (
        <p className="text-xs text-emerald-700">Working hours saved.</p>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save working hours'}
        </button>
      </div>
    </form>
  );
}
