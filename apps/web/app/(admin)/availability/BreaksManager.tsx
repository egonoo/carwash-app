'use client';

import { useState, useTransition } from 'react';
import { saveBreaks } from '@/actions/availability';

type Window = { start: string; end: string };
type DayState = { dayOfWeek: number; windows: Window[] };

export type BreaksInitial = { days: DayState[] };

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function BreaksManager({ initial }: { initial: BreaksInitial }) {
  const [days, setDays] = useState<DayState[]>(initial.days);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function update(dayIdx: number, mut: (windows: Window[]) => Window[]) {
    const next = days.slice();
    next[dayIdx] = { ...next[dayIdx]!, windows: mut(next[dayIdx]!.windows) };
    setDays(next);
  }

  function addWindow(dayIdx: number) {
    update(dayIdx, (ws) => [...ws, { start: '12:00', end: '13:00' }]);
  }

  function removeWindow(dayIdx: number, wIdx: number) {
    update(dayIdx, (ws) => ws.filter((_, i) => i !== wIdx));
  }

  function setWindow(dayIdx: number, wIdx: number, patch: Partial<Window>) {
    update(dayIdx, (ws) => ws.map((w, i) => (i === wIdx ? { ...w, ...patch } : w)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);

    for (const d of days) {
      for (const w of d.windows) {
        if (w.start >= w.end) {
          setError(`${DAY_LABELS[d.dayOfWeek]}: break end must be after start.`);
          return;
        }
      }
    }

    startTransition(async () => {
      try {
        await saveBreaks({ days });
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
      <div className="space-y-2">
        {days.map((d, i) => (
          <div key={d.dayOfWeek} className="rounded border bg-neutral-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{DAY_LABELS[d.dayOfWeek]}</div>
              <button
                type="button"
                onClick={() => addWindow(i)}
                className="rounded border bg-white px-2 py-0.5 text-xs hover:bg-neutral-100"
              >
                + Add break
              </button>
            </div>
            {d.windows.length === 0 ? (
              <div className="mt-1 text-xs text-neutral-400">No breaks.</div>
            ) : (
              <ul className="mt-2 space-y-1">
                {d.windows.map((w, wi) => (
                  <li key={wi} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={w.start}
                      onChange={(e) => setWindow(i, wi, { start: e.target.value })}
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <span className="text-xs text-neutral-500">to</span>
                    <input
                      type="time"
                      value={w.end}
                      onChange={(e) => setWindow(i, wi, { end: e.target.value })}
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeWindow(i, wi)}
                      className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {savedAt && !error && <p className="text-xs text-emerald-700">Breaks saved.</p>}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save breaks'}
        </button>
      </div>
    </form>
  );
}
