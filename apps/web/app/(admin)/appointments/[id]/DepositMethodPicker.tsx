'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAdminDepositMethod } from '@/actions/admin-appointment-method';

type Props = {
  appointmentId: string;
  current: 'cash' | 'zelle' | null;
};

export function DepositMethodPicker(props: Props) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<'cash' | 'zelle' | null>(props.current);

  function pick(method: 'cash' | 'zelle') {
    setErr(null);
    startTransition(async () => {
      try {
        await setAdminDepositMethod({ appointmentId: props.appointmentId, method });
        setCurrent(method);
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-neutral-600">
        Current method: <span className="font-medium">{current ?? '—'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
          onClick={() => pick('cash')}
          disabled={pending || current === 'cash'}
        >
          Cash
        </button>
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
          onClick={() => pick('zelle')}
          disabled={pending || current === 'zelle'}
        >
          Zelle
        </button>
      </div>
      {err && <div className="text-sm text-danger">{err}</div>}
    </div>
  );
}
