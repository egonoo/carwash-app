import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';

export default async function CustomersPage() {
  const session = await requireSession();

  const customers = await withTenant(session.activeBusinessId, (tx) =>
    tx.customer.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneE164: true,
        createdAt: true,
      },
    }),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Customers</h1>
      <p className="mt-1 text-sm text-neutral-600">Latest 100 customers.</p>

      <div className="mt-6 overflow-x-auto">
        {customers.length === 0 ? (
          <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-500">
            No customers yet.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium">
                    {c.firstName} {c.lastName ?? ''}
                  </td>
                  <td className="px-3 py-2">{c.email}</td>
                  <td className="px-3 py-2">{c.phoneE164}</td>
                  <td className="px-3 py-2 text-neutral-500">
                    {new Date(c.createdAt).toLocaleDateString()}
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
