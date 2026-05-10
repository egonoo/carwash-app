import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';

export default async function AppointmentsPage() {
  const session = await requireSession();

  const appointments = await withTenant(session.activeBusinessId, (tx) =>
    tx.appointment.findMany({
      orderBy: { startsAt: 'desc' },
      take: 50,
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Appointments</h1>
        <Link
          href={'/appointments/new' as any}
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          New appointment
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-600">Latest 50 appointments.</p>

      <div className="mt-6 space-y-2">
        {appointments.length === 0 && (
          <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-500">
            No appointments yet.
          </div>
        )}
        {appointments.map((a) => (
          <Link
            key={a.id}
            href={`/appointments/${a.id}` as any}
            className="flex items-center justify-between rounded border bg-white px-4 py-3 hover:bg-neutral-50"
          >
            <div>
              <div className="font-medium">
                {a.customer?.firstName ?? 'Unknown'} {a.customer?.lastName ?? ''}
              </div>
              <div className="text-xs text-neutral-500">
                {new Date(a.startsAt).toLocaleString()}
              </div>
            </div>
            <span className="rounded bg-neutral-100 px-2 py-1 text-xs">{a.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
