'use client';

import { useEffect, useMemo, useState } from 'react';
import { humanizeBookingError, type HumanizedError } from '@/lib/booking-validation';
import type { WizardPhoto, WizardState } from './state';

type Business = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  features: Record<string, boolean>;
};

type DraftResult = {
  appointmentId: string;
  depositMethod: 'card' | 'zelle';
  clientSecret: string | null;
  depositAmountCents: number;
};

type PhotoUploadStatus = 'pending' | 'uploading' | 'done' | 'failed';
type PhotoUploadEntry = { id: string; status: PhotoUploadStatus; errorMsg?: string };

type Breakdown = {
  subtotalCents: number;
  discounts: Array<{ label: string; amountCents: number }>;
  taxCents: number;
  totalCents: number;
  depositAmountCents: number;
  balanceDueOnServiceCents: number;
  loyalty?: { rewardAvailable?: boolean };
};

export function StepReviewPay({
  business,
  state,
  onChange,
  onBack,
  onPickAnotherTime,
  onBookingSucceeded,
}: {
  business: Business;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onBack: () => void;
  /** Called when the customer wants to bounce back to the date/time step
   *  after a SLOT_CONFLICT. Wizard clears state.startsAtISO and jumps to
   *  step "datetime". */
  onPickAnotherTime?: () => void;
  /** Fired exactly once when the server returns a non-replayed success or
   *  an idempotent replay. Wizard uses this to drop the persisted
   *  sessionStorage idempotency key so the next /book visit starts a new
   *  attempt instead of reusing this one. */
  onBookingSucceeded?: () => void;
}) {
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [previewError, setPreviewError] = useState<HumanizedError | null>(null);
  const [submitError, setSubmitError] = useState<HumanizedError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [uploads, setUploads] = useState<PhotoUploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!state.packageId || !state.vehicleTypeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/booking/price-preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            businessId: business.id,
            packageId: state.packageId,
            vehicleTypeId: state.vehicleTypeId,
            zoneId: state.zoneId ?? undefined,
            addons: state.addons,
            customerEmail: state.customer.email,
            promoCode: state.promoCode,
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.ok) {
          setBreakdown(json.data as Breakdown);
          setPreviewError(null);
        } else {
          setPreviewError(humanizeBookingError(json));
        }
      } catch (err) {
        if (cancelled) return;
        setPreviewError(humanizeBookingError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    business.id,
    state.packageId,
    state.vehicleTypeId,
    state.zoneId,
    state.addons,
    state.customer.email,
    state.promoCode,
  ]);

  const consentMissing = !state.evidenceConsent.currentStateAccepted;
  const submitDisabled = submitting || consentMissing || !breakdown;

  async function submit() {
    if (!state.zoneId || !state.startsAtISO || !state.vehicleTypeId || !state.packageId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/booking/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          zoneId: state.zoneId,
          startsAt: state.startsAtISO,
          packageId: state.packageId,
          vehicleTypeId: state.vehicleTypeId,
          addons: state.addons,
          vehicle: { ...state.vehicle, vehicleTypeId: state.vehicleTypeId },
          customer: {
            email: state.customer.email,
            firstName: state.customer.firstName,
            lastName: state.customer.lastName,
            phone: state.customer.phone,
            addressLine1: state.customer.addressLine1,
            addressLine2: state.customer.addressLine2,
            addressCity: state.customer.addressCity,
            addressState: state.customer.addressState,
            addressZip: state.customer.addressZip,
            customerInstructions: state.customer.instructions,
            marketingConsent: state.customer.marketingConsent,
            nonRefundableDepositAccepted: state.customer.nonRefundableAccepted,
          },
          evidenceConsent: state.evidenceConsent,
          promoCode: state.promoCode,
          idempotencyKey: state.idempotencyKey,
          depositMethod: state.depositMethod,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setSubmitError(humanizeBookingError(json));
        return;
      }
      const appointmentId: string = json.data.appointmentId;
      setResult({
        appointmentId,
        depositMethod: json.data.depositMethod,
        clientSecret: json.data.clientSecret,
        depositAmountCents: json.data.depositAmountCents,
      });
      // Persistent sessionStorage key can be cleared now — the booking is
      // durably committed and any further visits to /book should start a
      // fresh attempt. The result card itself does not rely on the key.
      onBookingSucceeded?.();
      const valid = state.photos.filter((p) => p.status === 'ok');
      if (valid.length > 0) {
        void uploadPhotos(appointmentId, valid);
      }
    } catch (err) {
      setSubmitError(humanizeBookingError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadPhotos(appointmentId: string, photos: WizardPhoto[]) {
    setUploading(true);
    setUploads(photos.map((p) => ({ id: p.id, status: 'pending' })));
    await Promise.all(photos.map((p) => uploadOne(appointmentId, p)));
    setUploading(false);
  }

  async function uploadOne(appointmentId: string, photo: WizardPhoto) {
    setUploads((prev) =>
      prev.map((u) => (u.id === photo.id ? { ...u, status: 'uploading', errorMsg: undefined } : u)),
    );
    try {
      const presignRes = await fetch('/api/photos/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appointmentId,
          phase: 'pre_service_customer',
          mimeType: photo.file.type,
          bytes: photo.file.size,
        }),
      });
      const presign = await presignRes.json();
      if (!presign.ok) {
        throw new Error(presign.message ?? 'Could not presign upload');
      }
      const { uploadUrl, uploadHeaders } = presign.data as {
        uploadUrl: string;
        uploadHeaders: Record<string, string>;
      };
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: uploadHeaders,
        body: photo.file,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }
      setUploads((prev) =>
        prev.map((u) => (u.id === photo.id ? { ...u, status: 'done' } : u)),
      );
    } catch (e) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === photo.id
            ? { ...u, status: 'failed', errorMsg: (e as Error).message }
            : u,
        ),
      );
    }
  }

  function retryFailedUploads() {
    if (!result) return;
    const failedIds = new Set(uploads.filter((u) => u.status === 'failed').map((u) => u.id));
    if (failedIds.size === 0) return;
    const photos = state.photos.filter((p) => failedIds.has(p.id) && p.status === 'ok');
    if (photos.length === 0) return;
    setUploading(true);
    Promise.all(photos.map((p) => uploadOne(result.appointmentId, p))).finally(() =>
      setUploading(false),
    );
  }

  const formattedDate = useMemo(() => formatDate(state.startsAtISO, business.timezone), [state.startsAtISO, business.timezone]);
  const vehicleSummary = useMemo(() => formatVehicleLine(state.vehicle), [state.vehicle]);
  const addressSummary = useMemo(() => formatAddress(state.customer), [state.customer]);

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Review and pay deposit</h2>
        <p className="mt-1 text-sm text-neutral-600">One last check before we hold your time slot.</p>
      </header>

      {/* Summary */}
      <div className="card divide-y divide-neutral-200/70 p-0">
        <SummaryRow label="When" value={formattedDate ?? 'Pick a time'} />
        <SummaryRow
          label="Where"
          value={state.detectedZone?.name ?? '—'}
          sub={addressSummary || undefined}
        />
        <SummaryRow label="Vehicle" value={vehicleSummary} />
        <SummaryRow
          label="Contact"
          value={`${(state.customer.firstName ?? '').trim()} ${(state.customer.lastName ?? '').trim()}`.trim() || '—'}
          sub={[state.customer.email, state.customer.phone].filter(Boolean).join(' · ') || undefined}
        />
      </div>

      {/* Price */}
      {previewError ? (
        <ErrorBanner error={previewError} />
      ) : breakdown ? (
        <div className="card space-y-2 text-sm">
          <Row label="Subtotal" value={money(breakdown.subtotalCents)} />
          {breakdown.discounts.map((d, i) => (
            <Row key={i} label={d.label} value={`−${money(d.amountCents)}`} tone="accent" />
          ))}
          {breakdown.taxCents > 0 && <Row label="Tax" value={money(breakdown.taxCents)} />}
          <div className="my-2 h-px bg-neutral-200/70" />
          <Row label="Total" value={money(breakdown.totalCents)} strong />
          <Row label="Deposit today" value={money(breakdown.depositAmountCents)} strong tone="brand" />
          <Row
            label="Balance on service"
            value={money(breakdown.balanceDueOnServiceCents)}
            muted
          />
          {breakdown.loyalty?.rewardAvailable && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent">
              <span aria-hidden>🎉</span>
              <span>A loyalty reward has been applied to this booking automatically.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="card text-sm text-neutral-500">Calculating your total…</div>
      )}

      {/* Deposit method */}
      {!result && (
        <div className="card">
          <div className="text-sm font-semibold">Deposit method</div>
          <p className="mt-1 text-xs text-neutral-500">
            The deposit secures your time slot. The balance is paid on the day of service.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <MethodRadio
              label="Credit / debit card"
              sublabel="Charged now via Stripe"
              checked={state.depositMethod === 'card'}
              onChange={() => onChange({ depositMethod: 'card' })}
            />
            <MethodRadio
              label="Zelle"
              sublabel="Send manually, we confirm"
              checked={state.depositMethod === 'zelle'}
              onChange={() => onChange({ depositMethod: 'zelle' })}
            />
          </div>
        </div>
      )}

      {/*
        Condition consent fallback. If the photos step is enabled this was
        already collected and gated there. If photos are disabled, surface it
        here so the strict server-side z.literal(true) check still passes.
      */}
      {!result && !business.features.photos && (
        <div className="card text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={state.evidenceConsent.currentStateAccepted}
              onChange={(e) =>
                onChange({
                  evidenceConsent: {
                    ...state.evidenceConsent,
                    currentStateAccepted: e.target.checked,
                  },
                })
              }
            />
            <span>
              <strong>I confirm my vehicle is in the condition described</strong>{' '}
              and accept that the {business.name} team will document any pre-existing
              damage on arrival (required).
            </span>
          </label>
        </div>
      )}

      {submitError && (
        <ErrorBanner
          error={submitError}
          action={
            submitError.code === 'SLOT_CONFLICT' && onPickAnotherTime
              ? {
                  label: 'Pick another time',
                  onClick: onPickAnotherTime,
                }
              : undefined
          }
        />
      )}

      {!result ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className="btn-ghost" onClick={onBack} disabled={submitting}>
            Back
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={submitDisabled}
            aria-disabled={submitDisabled}
          >
            {submitting
              ? 'Processing…'
              : state.depositMethod === 'zelle'
                ? `Reserve with Zelle${breakdown ? ` — ${money(breakdown.depositAmountCents)}` : ''}`
                : `Pay deposit${breakdown ? ` ${money(breakdown.depositAmountCents)}` : ''}`}
          </button>
        </div>
      ) : result.depositMethod === 'zelle' ? (
        <div className="card space-y-2 text-sm">
          <p className="text-base font-semibold">Reservation created — awaiting Zelle transfer.</p>
          <p className="text-neutral-700">
            Send <strong>{money(result.depositAmountCents)}</strong> via Zelle to:
          </p>
          <ul className="ml-4 list-disc text-neutral-700">
            <li>
              Zelle contact: <code className="rounded bg-neutral-100 px-1 py-0.5 text-[12px]">payments@{business.slug}.splash.app</code>
            </li>
            <li>
              Memo / note: <code className="rounded bg-neutral-100 px-1 py-0.5 text-[12px]">{result.appointmentId.slice(0, 8)}</code>
            </li>
          </ul>
          <p className="text-xs text-neutral-500">
            Your booking will be confirmed once {business.name} verifies the transfer.
            If the deposit is not received within 24h, the reservation will be released.
          </p>
        </div>
      ) : (
        <div className="card text-sm">
          <p className="text-base font-semibold">Appointment created.</p>
          <p className="mt-1 text-neutral-600">
            Complete the payment with Stripe Elements using the client secret below.
          </p>
          <code className="mt-2 block break-all rounded bg-neutral-50 p-2 text-xs">
            {result.clientSecret}
          </code>
          <p className="mt-2 text-xs text-neutral-500">
            Next iteration: embed &lt;Elements /&gt; from @stripe/react-stripe-js to finalize the charge.
          </p>
        </div>
      )}

      {result && uploads.length > 0 && (
        <UploadsPanel uploads={uploads} uploading={uploading} onRetry={retryFailedUploads} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function ErrorBanner({
  error,
  action,
}: {
  error: HumanizedError;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger/[0.06] p-3 text-sm text-danger"
    >
      <div className="font-semibold">{error.title}</div>
      <p className="mt-0.5 text-danger/90">{error.message}</p>
      {error.fieldHints.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-[13px] text-danger/90">
          {error.fieldHints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 inline-flex items-center rounded-md border border-danger/40 bg-white px-3 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger/[0.08]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="min-w-0 text-right">
        <span className="block truncate font-medium text-neutral-900">{value || '—'}</span>
        {sub && <span className="mt-0.5 block text-xs text-neutral-500">{sub}</span>}
      </span>
    </div>
  );
}

function UploadsPanel({
  uploads,
  uploading,
  onRetry,
}: {
  uploads: PhotoUploadEntry[];
  uploading: boolean;
  onRetry: () => void;
}) {
  const done = uploads.filter((u) => u.status === 'done').length;
  const failed = uploads.filter((u) => u.status === 'failed').length;
  const total = uploads.length;
  return (
    <div className="card space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Photos</span>
        <span className="text-xs text-neutral-500">
          {done}/{total} uploaded{failed > 0 && ` · ${failed} failed`}
        </span>
      </div>
      {failed > 0 && !uploading && (
        <button type="button" className="btn-ghost text-xs" onClick={onRetry}>
          Retry failed uploads
        </button>
      )}
      <ul className="space-y-1 text-xs">
        {uploads.map((u) => (
          <li key={u.id} className="flex items-center justify-between">
            <span className="truncate text-neutral-600">{u.id.slice(0, 24)}</span>
            <span
              className={
                u.status === 'done'
                  ? 'text-accent'
                  : u.status === 'failed'
                    ? 'text-danger'
                    : 'text-neutral-500'
              }
            >
              {u.status === 'done' && '✓ uploaded'}
              {u.status === 'uploading' && 'uploading…'}
              {u.status === 'pending' && 'queued'}
              {u.status === 'failed' && (u.errorMsg ?? 'failed')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MethodRadio({
  label,
  sublabel,
  checked,
  onChange,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={`rounded-md border p-3 text-left transition ${
        checked
          ? 'border-[color:var(--brand)] bg-[color:var(--brand)]/5 ring-1 ring-[color:var(--brand)]'
          : 'border-neutral-200 hover:bg-neutral-50'
      }`}
    >
      <div className="font-medium">{label}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{sublabel}</div>
    </button>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
  muted,
}: {
  label: string;
  value: string;
  tone?: 'accent' | 'brand';
  strong?: boolean;
  muted?: boolean;
}) {
  const toneClass =
    tone === 'accent' ? 'text-accent' : tone === 'brand' ? 'text-[color:var(--brand-ink)]' : '';
  return (
    <div
      className={`flex justify-between ${toneClass} ${strong ? 'font-semibold' : ''} ${muted ? 'text-neutral-500' : ''}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return iso;
  }
}

function formatVehicleLine(v: WizardState['vehicle']): string {
  const parts = [v.year?.toString(), v.make, v.model].filter(Boolean) as string[];
  const head = parts.join(' ');
  const tail = [v.color, v.plate && `plate ${v.plate}${v.plateState ? ` · ${v.plateState}` : ''}`]
    .filter(Boolean)
    .join(' · ');
  return [head, tail].filter(Boolean).join(' — ') || '—';
}

function formatAddress(c: WizardState['customer']): string {
  const line1 = c.addressLine1?.trim() ?? '';
  const line2 = c.addressLine2?.trim() ?? '';
  const city = c.addressCity?.trim() ?? '';
  const stateCode = c.addressState?.trim() ?? '';
  const zip = c.addressZip?.trim() ?? '';
  const street = [line1, line2].filter(Boolean).join(' ');
  const tail = [city, stateCode].filter(Boolean).join(', ');
  return [street, tail, zip].filter(Boolean).join(' · ');
}
