import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';

export default async function DashboardPage() {
  const session = await requireSession();
  const { appts, redemptions, revenue } = await withTenant(session.activeBusinessId, async (tx) => {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const [appts, redemptions, revenue] = await Promise.all([
      tx.appointment.count({
        where: { createdAt: { gte: start } },
      }),
      tx.loyaltyRedemption.count({
        where: { createdAt: { gte: start }, revokedAt: null },
      }),
      tx.payment.aggregate({
        where: { processedAt: { gte: start } },
        _sum: { amountCents: true },
      }),
    ]);
    return { appts, redemptions, revenue: revenue._sum.amountCents ?? 0 };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Appointments (30d)" value={appts.toString()} />
        <Stat label="Revenue (30d)" value={`$${(revenue / 100).toFixed(0)}`} />
        <Stat label="Loyalty redemptions (30d)" value={redemptions.toString()} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
    </div>
  );
}
