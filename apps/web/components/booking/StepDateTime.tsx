'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { WizardState } from './state';

type SlotBucket = 'morning' | 'afternoon' | 'evening';
type DaySlot = {
  time: string;
  label: string;
  isoStartsAt: string;
  available: boolean;
  bucket: SlotBucket;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'closed' }
  | { kind: 'ready'; slots: DaySlot[] }
  | { kind: 'error' };

const BUCKETS: Array<{ key: SlotBucket; label: string }> = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
];

/**
 * Step 2 — "When works best?".
 *
 * Visual slot picker. After the customer selects a date, we fetch the day's
 * 30-minute slot grid from /api/booking/availability/day-slots and render
 * available/unavailable chips grouped by time of day. Continue is enabled
 * only after the customer picks an available slot. The chosen slot's
 * canonical UTC ISO is stored in WizardState.startsAtISO; the duration-aware
 * engine still re-validates at draft creation.
 */
export function StepDateTime({
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
  const [date, setDate] = useState<string>(state.startsAtISO?.slice(0, 10) ?? '');
  const [selectedISO, setSelectedISO] = useState<string | null>(state.startsAtISO);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const requestId = useRef(0);

  useEffect(() => {
    if (!date) {
      setStatus({ kind: 'idle' });
      return;
    }

    const ticket = ++requestId.current;
    setStatus({ kind: 'loading' });

    (async () => {
      try {
        const res = await fetch('/api/booking/availability/day-slots', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            businessId,
            zoneId: state.zoneId ?? undefined,
            date,
          }),
        });
        const json = await res.json();
        if (ticket !== requestId.current) return;

        if (!res.ok || json.ok === false) {
          setStatus({ kind: 'error' });
          return;
        }
        if (json.data.closed) {
          setStatus({ kind: 'closed' });
          return;
        }
        setStatus({ kind: 'ready', slots: json.data.slots as DaySlot[] });
      } catch {
        if (ticket !== requestId.current) return;
        setStatus({ kind: 'error' });
      }
    })();
  }, [businessId, state.zoneId, date]);

  // Drop selection if the slot is no longer in the list or is unavailable.
  useEffect(() => {
    if (status.kind !== 'ready' || !selectedISO) return;
    const stillValid = status.slots.some(
      (s) => s.isoStartsAt === selectedISO && s.available,
    );
    if (!stillValid) setSelectedISO(null);
  }, [status, selectedISO]);

  const grouped = useMemo(() => {
    const buckets: Record<SlotBucket, DaySlot[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    if (status.kind === 'ready') {
      for (const s of status.slots) buckets[s.bucket].push(s);
    }
    return buckets;
  }, [status]);

  const hasAnySlot =
    status.kind === 'ready' && status.slots.some((s) => s.available);

  function handleContinue() {
    if (!selectedISO) return;
    onChange({ startsAtISO: selectedISO });
    onNext();
  }

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">When works best?</h2>

      <div>
        <label className="label">Date</label>
        <input
          type="date"
          className="input mt-1"
          min={minDate}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedISO(null);
          }}
        />
      </div>

      {status.kind === 'idle' && (
        <p className="text-xs text-neutral-500">Pick a date to see available times.</p>
      )}

      {status.kind === 'loading' && (
        <p className="text-xs text-neutral-500">Loading available times…</p>
      )}

      {status.kind === 'error' && (
        <p className="text-xs text-amber-700">
          Could not load availability. Please try again.
        </p>
      )}

      {status.kind === 'closed' && (
        <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-600">
          We are closed on this day. Please choose another date.
        </div>
      )}

      {status.kind === 'ready' && !hasAnySlot && (
        <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-600">
          No times are available on this day. Please choose another date.
        </div>
      )}

      {status.kind === 'ready' && hasAnySlot && (
        <div className="space-y-4">
          {BUCKETS.map(({ key, label }) => {
            const slots = grouped[key];
            if (!slots.length) return null;
            return (
              <div key={key}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {label}
                </h3>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {slots.map((s) => {
                    const isSelected = selectedISO === s.isoStartsAt;
                    const base =
                      'flex min-h-[44px] items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors';
                    const cls = !s.available
                      ? `${base} cursor-not-allowed border border-neutral-200 bg-neutral-100 text-neutral-400 line-through`
                      : isSelected
                        ? `${base} bg-[color:var(--brand)] text-white border border-transparent`
                        : `${base} border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50`;
                    return (
                      <button
                        key={s.isoStartsAt}
                        type="button"
                        disabled={!s.available}
                        aria-pressed={isSelected}
                        aria-label={`${s.label}${s.available ? '' : ' (unavailable)'}`}
                        onClick={() => s.available && setSelectedISO(s.isoStartsAt)}
                        className={cls}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-neutral-500">
        Times reflect working hours, breaks, and blocked time. We re-check
        against your service duration in the last step before payment.
      </p>

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button
          className="btn-primary"
          disabled={!selectedISO}
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </section>
  );
}
