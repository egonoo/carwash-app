import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';

export default async function BookingsPage() {
  const session = await requireSession();

  const bookings = await withTenant(session.activeBusinessId, (tx) =>
    tx.appointment.findMany({
      orderBy: { startsAt: 'desc' },
      take: 50,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        zone: { select: { name: true } },
      },
    }),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bookings</h1>
          <p className="mt-1 text-sm text-neutral-600">Latest 50 bookings for your business.</p>
        </div>
      </header>

      <div className="space-y-3">
        {bookings.length === 0 ? (
          <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-500">
            No bookings found.
          </div>
        ) : (
          bookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}` as any}
              className="flex items-center justify-between gap-4 rounded border bg-white px-4 py-4 transition hover:border-neutral-300 hover:bg-neutral-50"
            >
              <div>
                <div className="font-medium">
                  {booking.customer?.firstName ?? 'Unknown'} {booking.customer?.lastName ?? ''}
                </div>
                <div className="text-xs text-neutral-500">
                  {new Date(booking.startsAt).toLocaleString()} · {booking.zone?.name ?? 'No zone'}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${(booking.totalCents / 100).toFixed(2)}</div>
                <div className="text-xs text-neutral-500">
                  {booking.status} · {booking.depositStatus} · {booking.balanceStatus}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
