import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { BookingPhotoGallery } from '../BookingPhotoGallery';
import { PaymentActions } from '../../appointments/[id]/PaymentActions';

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

  const booking = await withTenant(session.activeBusinessId, (tx) =>
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
          select: { id: true, phase: true, note: true, uploadedAt: true, scanStatus: true },
        },
        statusHistory: { orderBy: { changedAt: 'desc' }, take: 20 },
      },
    }),
  );

  if (!booking) return notFound();

  const evidencePhotos = booking.evidencePhotos.map((photo) => ({
    ...photo,
    uploadedAt: photo.uploadedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Booking detail</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {booking.customer.firstName} {booking.customer.lastName} · {booking.zone.name}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold">{formatCurrency(booking.totalCents)}</div>
          <div className="text-sm text-neutral-500">
            Deposit {formatCurrency(booking.depositAmountCents)} · Balance {formatCurrency(booking.balanceDueCents)}
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between gap-4">
        <Link href="/bookings" className="text-sm text-[color:var(--brand)] hover:underline">
          ← Back to bookings
        </Link>
        <div className="rounded-full bg-neutral-100 px-3 py-1 text-sm uppercase tracking-wide text-neutral-600">
          {booking.status}
        </div>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold">Customer & vehicle</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 text-sm">
            <div className="label">Customer</div>
            <div>{booking.customer.firstName} {booking.customer.lastName}</div>
            <div className="text-neutral-500">{booking.customer.email}</div>
            <div className="text-neutral-500">{booking.customer.phoneE164}</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="label">Vehicle</div>
            <div>{booking.vehicle.make} {booking.vehicle.model} {booking.vehicle.year}</div>
            <div className="text-neutral-500">
              {booking.vehicle.internalCode} · {booking.vehicle.plate ?? 'No plate'} {booking.vehicle.plateState ?? ''}
            </div>
            <div className="text-neutral-500">VIN: {booking.vehicle.vin ?? 'Unknown'}</div>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2">Item</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Unit</th>
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {booking.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="py-3">
                    <div className="font-medium">{item.nameSnapshot}</div>
                    {item.pricingNotes && <div className="text-xs text-neutral-500">{item.pricingNotes}</div>}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unitPriceCents)}</td>
                  <td>{formatCurrency(item.lineTotalCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td colSpan={3} className="py-3 text-right font-semibold">Subtotal</td>
                <td>{formatCurrency(booking.subtotalCents)}</td>
              </tr>
              {booking.discountTotalCents > 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-right text-accent">Discounts</td>
                  <td className="text-accent">−{formatCurrency(booking.discountTotalCents)}</td>
                </tr>
              )}
              {booking.taxCents > 0 && (
                <tr>
                  <td colSpan={3} className="py-2 text-right">Tax</td>
                  <td>{formatCurrency(booking.taxCents)}</td>
                </tr>
              )}
              <tr className="border-t">
                <td colSpan={3} className="py-3 text-right font-semibold">Total</td>
                <td className="font-semibold">{formatCurrency(booking.totalCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Evidence photos</h2>
        <div className="mt-4">
          <BookingPhotoGallery photos={evidencePhotos} />
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Payment actions</h2>
        <div className="mt-4">
          <PaymentActions
            appointmentId={booking.id}
            status={booking.status}
            depositStatus={booking.depositStatus}
            depositMethod={booking.depositMethod}
            depositAmountCents={booking.depositAmountCents}
            balanceStatus={booking.balanceStatus}
            balanceMethod={booking.balanceMethod}
            balanceDueCents={booking.balanceDueCents}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">History</h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-600">
          {booking.statusHistory.length === 0 ? (
            <li>No status history available.</li>
          ) : (
            booking.statusHistory.map((history) => (
              <li key={history.id}>
                {new Date(history.changedAt).toLocaleString()} · {history.fromStatus ?? 'new'} → {history.toStatus}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
