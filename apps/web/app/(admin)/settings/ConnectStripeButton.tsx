'use client';

import { useState, useTransition } from 'react';
import { openStripeManageLink } from '@/actions/stripe-connect';

type Props = {
  hasAccount: boolean;
  ready: boolean;
};

export function ConnectStripeButton({ hasAccount, ready }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const label = !hasAccount
    ? 'Connect Stripe'
    : ready
      ? 'Open Stripe dashboard'
      : 'Finish Stripe setup';

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const { url } = await openStripeManageLink();
        window.location.href = url;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Stripe request failed');
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {isPending ? 'Opening Stripe…' : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
