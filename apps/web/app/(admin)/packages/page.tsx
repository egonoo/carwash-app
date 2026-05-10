import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { EditablePackageCard } from './EditablePackageCard';

export default async function PackagesPage() {
  const session = await requireSession();

  const packages = await withTenant(session.activeBusinessId, (tx) =>
    tx.package.findMany({
      where: { archivedAt: null },
      orderBy: { displayOrder: 'asc' },
      include: { prices: { include: { vehicleType: true } } },
    }),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Packages</h1>
      <p className="mt-1 text-sm text-neutral-600">Service catalog.</p>

      <div className="mt-6 space-y-3">
        {packages.length === 0 && (
          <div className="rounded border border-dashed p-6 text-center text-sm text-neutral-500">
            No packages yet. Run <code>pnpm db:seed</code>.
          </div>
        )}
        {packages.map((p) => (
          <EditablePackageCard
            key={p.id}
            pkg={{
              id: p.id,
              name: p.name,
              description: p.description,
              isActive: p.isActive,
              prices: p.prices.map((pr) => ({
                vehicleTypeId: pr.vehicleTypeId,
                vehicleTypeName: pr.vehicleType.name,
                priceCents: pr.priceCents,
                durationMinutes: pr.durationMinutes,
                isAvailable: pr.isAvailable,
              })),
            }}
          />
        ))}
      </div>
    </div>
  );
}
