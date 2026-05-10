import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { EditableAddonCard } from './EditableAddonCard';
import { NewAddonForm } from './NewAddonForm';

export default async function AddonsPage() {
  const session = await requireSession();

  const addons = await withTenant(session.activeBusinessId, (tx) =>
    tx.addon.findMany({
      where: { archivedAt: null },
      orderBy: { displayOrder: 'asc' },
    }),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Add-ons</h1>
      <p className="mt-1 text-sm text-neutral-600">Extras offered with packages.</p>

      <div className="mt-6 space-y-3">
        <NewAddonForm />

        <div className="grid gap-2 sm:grid-cols-2">
          {addons.length === 0 ? (
            <div className="col-span-full rounded border border-dashed p-6 text-center text-sm text-neutral-500">
              No add-ons yet.
            </div>
          ) : (
            addons.map((a) => (
              <EditableAddonCard
                key={a.id}
                addon={{
                  id: a.id,
                  name: a.name,
                  pricingMode: a.pricingMode,
                  basePriceCents: a.basePriceCents,
                  durationMinutes: a.durationMinutes,
                  isActive: a.isActive,
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
