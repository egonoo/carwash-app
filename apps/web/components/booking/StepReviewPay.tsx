'use client';

import { useEffect, useState } from 'react';
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

export function StepReviewPay({
  business,
  state,
  onChange,
  onBack,
}: {
  business: Business;
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onBack: () => void;
}) {
  const [breakdown, setBreakdown] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [uploads, setUploads] = useState<PhotoUploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!state.packageId || !state.vehicleTypeId) return;
    fetch('/api/booking/price-preview', {
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
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setBreakdown(j.data);
        else setErr(j.message);
      });
  }, [business.id, state.packageId, state.vehicleTypeId, state.zoneId, state.addons, state.customer.email, state.promoCode]);

  async function submit() {
    if (!state.zoneId || !state.startsAtISO || !state.vehicleTypeId || !state.packageId) return;
    setSubmitting(true);
    setErr(null);
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
      if (!json.ok) throw new Error(json.message ?? 'Error creating booking');
      const appointmentId: string = json.data.appointmentId;
      setResult({
        appointmentId,
        depositMethod: json.data.depositMethod,
        clientSecret: json.data.clientSecret,
        depositAmountCents: json.data.depositAmountCents,
      });
      // Subir fotos válidas en paralelo. Fallos no revierten el booking.
      const valid = state.photos.filter((p) => p.status === 'ok');
      if (valid.length > 0) {
        void uploadPhotos(appointmentId, valid);
      }
    } catch (e) {
      setErr((e as Error).message);
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

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Review and pay deposit</h2>

      {state.detectedZone && (
        <div className="card text-sm">
          <div>
            Service area: <strong>{state.detectedZone.name}</strong>
            {state.detectedZone.matchedBy === 'fallback' && (
              <span className="ml-1 text-xs text-neutral-500">(default)</span>
            )}
          </div>
          {state.detectedZone.extraFeeCents > 0 && (
            <div className="mt-1 text-neutral-700">
              Extra service area fee: ${(state.detectedZone.extraFeeCents / 100).toFixed(2)}
            </div>
          )}
        </div>
      )}

      {breakdown && (
        <div className="card space-y-2 text-sm">
          <Row label="Subtotal" value={`$${(breakdown.subtotalCents / 100).toFixed(2)}`} />
          {breakdown.discounts.map((d: any, i: number) => (
            <Row
              key={i}
              label={d.label}
              value={`−$${(d.amountCents / 100).toFixed(2)}`}
              tone="accent"
            />
          ))}
          {breakdown.taxCents > 0 && (
            <Row label="Tax" value={`$${(breakdown.taxCents / 100).toFixed(2)}`} />
          )}
          <Row label="Total" value={`$${(breakdown.totalCents / 100).toFixed(2)}`} strong />
          <hr className="my-2" />
          <Row
            label="Deposit today"
            value={`$${(breakdown.depositAmountCents / 100).toFixed(2)}`}
            strong
          />
          <Row
            label="Balance on service"
            value={`$${(breakdown.balanceDueOnServiceCents / 100).toFixed(2)}`}
          />
          {breakdown.loyalty?.rewardAvailable && (
            <div className="mt-2 rounded bg-accent/10 p-2 text-xs text-accent">
              🎉 Loyalty reward applied automatically.
            </div>
          )}
        </div>
      )}

      {!result && (
        <div className="card">
          <div className="text-sm font-semibold">Deposit method</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <MethodRadio
              label="Credit / debit card"
              sublabel="Charged now via secure checkout"
              checked={state.depositMethod === 'card'}
              onChange={() => onChange({ depositMethod: 'card' })}
            />
            <MethodRadio
              label="Zelle"
              sublabel="Transfer manually, admin confirms"
              checked={state.depositMethod === 'zelle'}
              onChange={() => onChange({ depositMethod: 'zelle' })}
            />
          </div>
        </div>
      )}

      {err && <div className="text-sm text-danger">{err}</div>}

      {!result ? (
        <div className="flex justify-between">
          <button className="btn-ghost" onClick={onBack}>Back</button>
          <button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting
              ? 'Processing…'
              : state.depositMethod === 'zelle'
                ? `Reserve (Zelle) ${breakdown ? `$${(breakdown.depositAmountCents / 100).toFixed(2)}` : ''}`
                : `Pay deposit ${breakdown ? `$${(breakdown.depositAmountCents / 100).toFixed(2)}` : ''}`}
          </button>
        </div>
      ) : result.depositMethod === 'zelle' ? (
        <div className="card space-y-2 text-sm">
          <p className="font-semibold">Reservation created — awaiting Zelle transfer.</p>
          <p className="text-neutral-700">
            Send <strong>${(result.depositAmountCents / 100).toFixed(2)}</strong> via Zelle to:
          </p>
          <ul className="list-disc pl-5 text-neutral-700">
            <li>
              Zelle contact: <code>payments@{business.slug}.splash.app</code>
            </li>
            <li>
              Memo / note: <code>{result.appointmentId.slice(0, 8)}</code>
            </li>
          </ul>
          <p className="text-xs text-neutral-500">
            Your booking will be confirmed once {business.name} verifies the transfer.
            If the deposit is not received within 24h, the reservation will be released.
          </p>
        </div>
      ) : (
        <div className="card text-sm">
          <p className="font-semibold">Appointment created.</p>
          <p className="mt-1 text-neutral-600">
            Complete the payment with Stripe Elements using client secret:
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
        <UploadsPanel
          uploads={uploads}
          uploading={uploading}
          onRetry={retryFailedUploads}
        />
      )}
    </section>
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
      className={`rounded border p-3 text-left transition ${
        checked ? 'border-[color:var(--brand)] bg-[color:var(--brand)]/5 ring-1 ring-[color:var(--brand)]' : 'hover:bg-neutral-50'
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
}: {
  label: string;
  value: string;
  tone?: 'accent';
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${tone === 'accent' ? 'text-accent' : ''} ${
        strong ? 'font-semibold' : ''
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
