import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { CustomerRowActions } from './CustomerRowActions';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showArchived = view === 'archived';
  const session = await requireSession();

  const customers = await withTenant(session.activeBusinessId, (tx) =>
    tx.customer.findMany({
      where: showArchived ? { deletedAt: { not: null } } : { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneE164: true,
        createdAt: true,
        deletedAt: true,
      },
    }),
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/customers"
            className={`rounded-md px-3 py-1.5 ${
              !showArchived ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Active
          </Link>
          <Link
            href={{ pathname: '/customers', query: { view: 'archived' } }}
            className={`rounded-md px-3 py-1.5 ${
              showArchived ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Archived
          </Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        {showArchived
          ? 'Latest 100 archived customers. Restore to send them back to the active list.'
          : 'Latest 100 active customers. Archive hides a customer from this list and from booking suggestions; their appointments, payments and photo history are kept.'}
      </p>

      <div className="mt-6 overflow-x-auto">
        {customers.length === 0 ? (
          <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-500">
            {showArchived ? 'No archived customers.' : 'No customers yet.'}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
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
                  <td className="px-3 py-2 text-right">
                    <CustomerRowActions
                      customerId={c.id}
                      archived={!!c.deletedAt}
                    />
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
