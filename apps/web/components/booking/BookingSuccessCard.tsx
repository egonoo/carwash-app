'use client';

/**
 * Shared success card. Rendered in two places:
 *
 *   1. Live from StepReviewPay after a successful submit (carries the fresh
 *      clientSecret on the card path).
 *   2. From BookingWizard on mount when a recent successful booking result
 *      is in sessionStorage — refresh / revisit shows the confirmation
 *      instead of restarting the wizard. Card path has no clientSecret in
 *      this branch because we deliberately do NOT persist it.
 *
 * "Book another car wash" is the only way to clear both the persisted
 * result and the idempotency key and restart the wizard.
 */

type Business = {
  name: string;
  slug: string;
};

export function BookingSuccessCard({
  business,
  appointmentId,
  depositMethod,
  depositAmountCents,
  clientSecret,
  onRestart,
}: {
  business: Business;
  appointmentId: string;
  depositMethod: 'card' | 'zelle';
  depositAmountCents: number;
  /** Only present on the live (just-submitted) card path. Persisted-result
   *  reloads intentionally omit this — Stripe will move to Elements in
   *  Phase 4; for now refresh-after-card simply shows the generic
   *  "appointment created" card without the secret. */
  clientSecret?: string | null;
  onRestart: () => void;
}) {
  if (depositMethod === 'zelle') {
    return (
      <div className="card space-y-3 text-sm">
        <p className="text-base font-semibold">Reservation created — awaiting Zelle transfer.</p>
        <p className="text-neutral-700">
          Send <strong>{money(depositAmountCents)}</strong> via Zelle to:
        </p>
        <ul className="ml-4 list-disc text-neutral-700">
          <li>
            Zelle contact:{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[12px]">
              payments@{business.slug}.splash.app
            </code>
          </li>
          <li>
            Memo / note:{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[12px]">
              {appointmentId.slice(0, 8)}
            </code>
          </li>
        </ul>
        <p className="text-xs text-neutral-500">
          Your booking will be confirmed once {business.name} verifies the transfer.
          If the deposit is not received within 24h, the reservation will be released.
        </p>
        <RestartRow onRestart={onRestart} />
      </div>
    );
  }

  return (
    <div className="card space-y-3 text-sm">
      <p className="text-base font-semibold">Appointment created.</p>
      {clientSecret ? (
        <>
          <p className="text-neutral-600">
            Complete the payment with Stripe Elements using the client secret below.
          </p>
          <code className="block break-all rounded bg-neutral-50 p-2 text-xs">
            {clientSecret}
          </code>
          <p className="text-xs text-neutral-500">
            Next iteration: embed &lt;Elements /&gt; from @stripe/react-stripe-js to finalize the charge.
          </p>
        </>
      ) : (
        <p className="text-neutral-600">
          We've reserved your time slot. Check your email — we sent the payment link there.
          If you don't see it, contact {business.name}.
        </p>
      )}
      <RestartRow onRestart={onRestart} />
    </div>
  );
}

function RestartRow({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={onRestart}
        className="text-xs font-medium text-[color:var(--brand)] underline-offset-2 hover:underline"
      >
        Book another car wash
      </button>
    </div>
  );
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
