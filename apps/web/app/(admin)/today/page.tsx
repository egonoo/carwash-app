import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import Link from 'next/link';

export default async function TodayPage() {
  const session = await requireSession();

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const appts = await withTenant(session.activeBusinessId, (tx) =>
    tx.appointment.findMany({
      where: {
        startsAt: { gte: start, lt: end },
        status: { notIn: ['cancelled', 'no_show', 'draft', 'rescheduled'] },
      },
      orderBy: { startsAt: 'asc' },
      include: {
        customer: { select: { firstName: true, lastName: true, phoneE164: true } },
        vehicle: { select: { internalCode: true, make: true, model: true, color: true } },
        zone: { select: { name: true, color: true } },
      },
    }),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-neutral-600">{appts.length} appointments</p>
      </header>
      <div className="space-y-3">
        {appts.map((a) => (
          <Link
            key={a.id}
            href={`/appointments/${a.id}` as any}
            className="card flex items-start justify-between gap-3 hover:bg-neutral-50"
          >
            <div>
              <div className="text-sm font-semibold">
                {a.startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                {a.zone.name}
              </div>
              <div className="mt-1 text-sm text-neutral-700">
                {a.customer.firstName} {a.customer.lastName} ·{' '}
                {a.vehicle.make} {a.vehicle.model}{' '}
                <span className="text-neutral-400">({a.vehicle.internalCode})</span>
              </div>
              <div className="mt-1 text-xs uppercase tracking-wide text-neutral-500">{a.status}</div>
            </div>
            <div className="text-right text-sm">
              <div>${(a.totalCents / 100).toFixed(2)}</div>
              <div className="text-xs text-neutral-500">
                bal ${(a.balanceDueCents / 100).toFixed(2)}
              </div>
            </div>
          </Link>
        ))}
        {appts.length === 0 && (
          <div className="card text-sm text-neutral-500">No appointments today.</div>
        )}
      </div>
    </div>
  );
}
