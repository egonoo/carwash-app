'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { confirmZelleDeposit, markBalancePaid } from '@/actions/admin-payments';

type Props = {
  appointmentId: string;
  status: string;
  depositStatus: string;
  depositMethod: string | null;
  depositAmountCents: number;
  balanceStatus: string;
  balanceMethod: string | null;
  balanceDueCents: number;
};

export function PaymentActions(props: Props) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>) {
    setErr(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  }

  const canConfirmZelle =
    props.depositStatus !== 'paid' &&
    (props.status === 'awaiting_zelle' || props.status === 'pending_deposit');
  const canMarkBalance = props.depositStatus === 'paid' && props.balanceStatus !== 'paid';

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold">Deposit</div>
        <div className="mt-1 text-sm text-neutral-600">
          ${(props.depositAmountCents / 100).toFixed(2)} ·{' '}
          <span className="uppercase">{props.depositStatus}</span>
          {props.depositMethod ? ` · ${props.depositMethod}` : ''}
        </div>
        {canConfirmZelle && (
          <button
            className="btn-primary mt-3"
            disabled={pending}
            onClick={() => run(() => confirmZelleDeposit(props.appointmentId))}
          >
            {pending ? 'Working…' : 'Confirm Zelle deposit'}
          </button>
        )}
      </div>

      <div>
        <div className="text-sm font-semibold">Balance</div>
        <div className="mt-1 text-sm text-neutral-600">
          ${(props.balanceDueCents / 100).toFixed(2)} ·{' '}
          <span className="uppercase">{props.balanceStatus}</span>
          {props.balanceMethod ? ` · ${props.balanceMethod}` : ''}
        </div>
        {canMarkBalance && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => run(() => markBalancePaid(props.appointmentId, 'cash'))}
            >
              Paid — Cash
            </button>
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => run(() => markBalancePaid(props.appointmentId, 'zelle'))}
            >
              Paid — Zelle
            </button>
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() => run(() => markBalancePaid(props.appointmentId, 'card'))}
            >
              Paid — Card
            </button>
          </div>
        )}
      </div>

      {err && <div className="text-sm text-danger">{err}</div>}
    </div>
  );
}
