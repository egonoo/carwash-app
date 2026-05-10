import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';

export default async function PaymentsPage() {
  const session = await requireSession();

  const payments = await withTenant(session.activeBusinessId, (tx) =>
    tx.payment.findMany({
      orderBy: { processedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        kind: true,
        method: true,
        amountCents: true,
        currency: true,
        processedAt: true,
        appointmentId: true,
      },
    }),
  );

  const total = payments.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Payments</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Last 50 payments · Total ${(total / 100).toFixed(2)}
      </p>

      <div className="mt-6 overflow-x-auto">
        {payments.length === 0 ? (
          <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-500">
            No payments yet.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Appointment</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 text-neutral-500">
                    {new Date(p.processedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{p.kind}</td>
                  <td className="px-3 py-2">{p.method}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    ${(p.amountCents / 100).toFixed(2)} {p.currency}
                  </td>
                  <td className="px-3 py-2">
                    <a href={`/appointments/${p.appointmentId}`} className="underline">
                      view
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
