import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { getVehicleLoyaltyProgress } from '@/lib/loyalty/progress';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PaymentActions } from './PaymentActions';
import { ItemsEditor } from './ItemsEditor';
import { DepositMethodPicker } from './DepositMethodPicker';
import { PhotoUploader } from './PhotoUploader';
import { BookingPhotoGallery } from '../../bookings/BookingPhotoGallery';

export default async function AppointmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ uploadPhotos?: string }>;
}) {
  const { id } = await params;
  const { uploadPhotos } = await searchParams;
  const showUploadPrompt = uploadPhotos === '1';
  const session = await requireSession();

  const appt = await withTenant(session.activeBusinessId, (tx) =>
    tx.appointment.findUnique({
      where: { id },
      include: {
        customer: { select: { firstName: true, lastName: true, email: true, phoneE164: true } },
        vehicle: {
          select: {
            id: true,
            internalCode: true,
            make: true,
            model: true,
            year: true,
            color: true,
            plate: true,
            plateState: true,
            vin: true,
          },
        },
        zone: { select: { name: true } },
        items: { orderBy: { displayOrder: 'asc' } },
        appliedDiscounts: true,
        payments: { orderBy: { processedAt: 'desc' } },
        evidencePhotos: {
          where: { softDeletedAt: null },
          orderBy: { uploadedAt: 'desc' },
          take: 50,
        },
        statusHistory: { orderBy: { changedAt: 'desc' }, take: 20 },
      },
    }),
  );

  if (!appt) return notFound();

  const loyaltyInfo = await getVehicleLoyaltyProgress(
    appt.vehicleId,
    session.activeBusinessId,
  );

  const isDraft = appt.status === 'draft';

  const { packages, addons, photosFeatureEnabled } = await withTenant(
    session.activeBusinessId,
    async (tx) => {
      const business = await tx.business.findUniqueOrThrow({
        where: { id: session.activeBusinessId },
        select: { features: true },
      });
      const features = (business.features ?? {}) as Record<string, boolean>;

      if (!isDraft) {
        return { packages: [], addons: [], photosFeatureEnabled: !!features.photos };
      }

      const [pkgs, ads] = await Promise.all([
        tx.package.findMany({
          where: { isActive: true, archivedAt: null },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true },
        }),
        tx.addon.findMany({
          where: { isActive: true, archivedAt: null },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true },
        }),
      ]);
      return { packages: pkgs, addons: ads, photosFeatureEnabled: !!features.photos };
    },
  );

  const currentPackageItem = appt.items.find((i) => i.kind === 'package');
  const currentAddonItems = appt.items
    .filter((i) => i.kind === 'addon' && i.refId)
    .map((i) => ({ addonId: i.refId!, quantity: i.quantity }));

  const vehicleParts = [appt.vehicle.year, appt.vehicle.make, appt.vehicle.model]
    .filter((p): p is string | number => p != null && p !== '')
    .join(' ');
  const vehicleLabel = vehicleParts || appt.vehicle.internalCode;
  const plateLine = [appt.vehicle.plate, appt.vehicle.plateState].filter(Boolean).join(' ');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Appointment</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {appt.startsAt.toLocaleString()} · {appt.zone.name} ·{' '}
            <span className="uppercase tracking-wide">{appt.status}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">${(appt.totalCents / 100).toFixed(2)}</div>
          <div className="text-sm text-neutral-500">
            deposit ${(appt.depositPaidCents / 100).toFixed(2)} · bal ${(appt.balanceDueCents / 100).toFixed(2)}
          </div>
        </div>
      </header>

      {showUploadPrompt && photosFeatureEnabled && (
        <section className="card border-2 border-[color:var(--brand)]">
          <h2 className="text-lg font-semibold">Upload photos for this appointment</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Add photos for this appointment now. You can also return here later.
          </p>
          <div className="mt-3">
            <PhotoUploader appointmentId={appt.id} />
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Customer & vehicle</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <div className="label">Customer</div>
            <div>
              {appt.customer.firstName} {appt.customer.lastName}
            </div>
            <div className="text-neutral-500">
              {appt.customer.email} · {appt.customer.phoneE164}
            </div>
          </div>
          <div>
            <div className="label">Vehicle</div>
            <Link
              href={`/vehicles/${appt.vehicle.id}` as any}
              className="text-[color:var(--brand)]"
            >
              {vehicleLabel}
            </Link>
            {appt.vehicle.color && (
              <div className="text-sm text-neutral-600">Color: {appt.vehicle.color}</div>
            )}
            <div className="text-xs text-neutral-500">
              {appt.vehicle.internalCode}
              {plateLine ? ` · ${plateLine}` : ''}
            </div>
            {loyaltyInfo && (
              <div
                className={`mt-2 rounded border px-2 py-1.5 text-xs ${
                  loyaltyInfo.rewardAvailable
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-900'
                }`}
              >
                <div className="font-medium">{loyaltyInfo.message}</div>
                <div className="mt-0.5 text-[11px] opacity-80">
                  {loyaltyInfo.currentVisits} completed services
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Items</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-2">Item</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {appt.items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="py-2">
                  <div className="font-medium">{it.nameSnapshot}</div>
                  {it.pricingNotes && <div className="text-xs text-neutral-500">{it.pricingNotes}</div>}
                </td>
                <td>{it.quantity}</td>
                <td>${(it.unitPriceCents / 100).toFixed(2)}</td>
                <td>${(it.lineTotalCents / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t">
              <td colSpan={3} className="py-2 text-right font-semibold">
                Subtotal
              </td>
              <td>${(appt.subtotalCents / 100).toFixed(2)}</td>
            </tr>
            {appt.discountTotalCents > 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-right text-accent">
                  Discounts
                </td>
                <td className="text-accent">−${(appt.discountTotalCents / 100).toFixed(2)}</td>
              </tr>
            )}
            {appt.taxCents > 0 && (
              <tr>
                <td colSpan={3} className="py-2 text-right">
                  Tax
                </td>
                <td>${(appt.taxCents / 100).toFixed(2)}</td>
              </tr>
            )}
            <tr className="border-t">
              <td colSpan={3} className="py-2 text-right font-semibold">
                Total
              </td>
              <td className="font-semibold">${(appt.totalCents / 100).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {isDraft && (
        <section className="card">
          <h2 className="text-lg font-semibold">Edit items (draft only)</h2>
          <div className="mt-3">
            <ItemsEditor
              appointmentId={appt.id}
              packages={packages}
              addons={addons}
              initialPackageId={currentPackageItem?.refId ?? null}
              initialAddons={currentAddonItems}
            />
          </div>
        </section>
      )}

      {isDraft && (
        <section className="card">
          <h2 className="text-lg font-semibold">Deposit method (draft only)</h2>
          <div className="mt-3">
            <DepositMethodPicker
              appointmentId={appt.id}
              current={
                appt.depositMethod === 'cash' || appt.depositMethod === 'zelle'
                  ? appt.depositMethod
                  : null
              }
            />
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="text-lg font-semibold">Photos ({appt.evidencePhotos.length})</h2>
        {photosFeatureEnabled ? (
          <div className="mt-3 space-y-4">
            {!showUploadPrompt && <PhotoUploader appointmentId={appt.id} />}
            <BookingPhotoGallery
              photos={appt.evidencePhotos.map((p) => ({
                id: p.id,
                phase: p.phase,
                note: p.note,
                uploadedAt: p.uploadedAt.toISOString(),
                scanStatus: p.scanStatus,
              }))}
            />
          </div>
        ) : (
          <p className="mt-1 text-xs text-neutral-500">
            Photos feature is disabled for this business.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Payment actions</h2>
        <div className="mt-3">
          <PaymentActions
            appointmentId={appt.id}
            status={appt.status}
            depositStatus={appt.depositStatus}
            depositMethod={appt.depositMethod}
            depositAmountCents={appt.depositAmountCents}
            balanceStatus={appt.balanceStatus}
            balanceMethod={appt.balanceMethod}
            balanceDueCents={appt.balanceDueCents}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Payments</h2>
        {appt.payments.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {appt.payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {p.kind} · {p.method}
                </span>
                <span>${(p.amountCents / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Status history</h2>
        <ul className="mt-3 space-y-1 text-xs text-neutral-600">
          {appt.statusHistory.map((h) => (
            <li key={h.id}>
              {h.changedAt.toLocaleString()} — {h.fromStatus ?? 'new'} → {h.toStatus}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
