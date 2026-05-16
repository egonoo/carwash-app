'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelAppointment } from '@/actions/appointment';

type Props = {
  appointmentId: string;
  status: string;
};

// Statuses where "cancelled" is reachable per the server-side TRANSITIONS
// table. The button hides itself entirely outside this set so the admin
// doesn't see a CTA that the server will reject.
const CANCELLABLE_STATUSES = new Set([
  'draft',
  'pending_deposit',
  'awaiting_zelle',
  'confirmed',
  'on_the_way',
  'arrived',
  'in_progress',
]);

export function CancelAppointmentButton({ appointmentId, status }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!CANCELLABLE_STATUSES.has(status)) return null;

  function submit() {
    setErr(null);
    setOk(false);
    startTransition(async () => {
      try {
        await cancelAppointment({
          appointmentId,
          reason: reason.trim() || undefined,
        });
        setOk(true);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setErr((e as Error).message ?? 'Could not cancel this appointment.');
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Cancel appointment</div>
          <p className="text-xs text-neutral-500">
            Frees the time slot and stops Zelle / card confirmation. Customer history is kept.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            className="rounded-md border border-danger/40 bg-white px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/[0.08]"
            onClick={() => {
              setErr(null);
              setOk(false);
              setOpen(true);
            }}
            disabled={pending}
          >
            Cancel appointment
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-md border border-danger/30 bg-danger/[0.04] p-3">
          <label className="block text-xs font-medium text-neutral-700">
            Reason (optional, internal)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Test booking / customer asked to reschedule / …"
            maxLength={500}
            className="input mt-1"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={submit}
              disabled={pending}
            >
              {pending ? 'Cancelling…' : 'Confirm cancel'}
            </button>
            <button
              type="button"
              className="btn-ghost px-3 py-1.5 text-xs"
              onClick={() => {
                setOpen(false);
                setReason('');
              }}
              disabled={pending}
            >
              Keep appointment
            </button>
          </div>
          {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        </div>
      )}

      {ok && !open && (
        <p className="text-xs text-emerald-700">
          Appointment cancelled. The time slot is free.
        </p>
      )}
    </div>
  );
}
