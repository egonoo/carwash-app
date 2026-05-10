import { prisma } from '@/lib/db';
import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { LoyaltyConfigForm } from './LoyaltyConfigForm';
import { LoyaltyTiersEditor } from './LoyaltyTiersEditor';
import { RedemptionsList } from './RedemptionsList';
import { redirect } from 'next/navigation';

export default async function LoyaltyAdminPage() {
  const session = await requireSession();

  const data = await withTenant(session.activeBusinessId, async (tx) => {
    const business = await tx.business.findUniqueOrThrow({
      where: { id: session.activeBusinessId },
      select: { features: true },
    });
    const features = business.features as Record<string, boolean>;

    const program = await tx.loyaltyProgram.findUnique({
      where: { businessId: session.activeBusinessId },
      include: {
        tiers: { orderBy: { displayOrder: 'asc' } },
      },
    });
    const packages = await tx.package.findMany({
      where: { businessId: session.activeBusinessId, archivedAt: null, isActive: true },
      select: {
        id: true,
        name: true,
        prices: {
          select: { priceCents: true },
          orderBy: { priceCents: 'asc' },
          take: 1,
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
    const recentRedemptions = await tx.loyaltyRedemption.findMany({
      where: { businessId: session.activeBusinessId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        vehicle: { select: { internalCode: true, make: true, model: true } },
        customer: { select: { firstName: true, lastName: true } },
      },
    });
    return { features, program, packages, recentRedemptions };
  });

  if (!data.features.loyalty) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">Loyalty</h1>
        <div className="card mt-6">
          <p className="text-sm text-neutral-600">
            Loyalty is disabled for this business. Enable it in Settings → Features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Loyalty program</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Loyalty rewards are applied per vehicle. Customers earn rewards as they
            complete services.
          </p>
        </div>
        {data.program && (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              data.program.isActive
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {data.program.isActive ? '● Active' : '○ Inactive'}
          </span>
        )}
      </header>

      <LoyaltyConfigForm
        initial={
          data.program
            ? {
                isActive: data.program.isActive,
                appliesToAddons: data.program.appliesToAddons,
                countPackagesOnly: data.program.countPackagesOnly,
                resetOnRedemption: data.program.resetOnRedemption,
                autoApply: data.program.autoApply,
                name: data.program.name ?? '',
                description: data.program.description ?? '',
              }
            : null
        }
      />

      {data.program ? (
        <LoyaltyTiersEditor
          tiers={data.program.tiers.map((t) => ({
            id: t.id,
            name: t.name,
            visitsRequired: t.visitsRequired,
            discountType: t.discountType,
            discountValue: t.discountValue,
            appliesToPackageIds: t.appliesToPackageIds,
            maxRedemptionsPerVehicle: t.maxRedemptionsPerVehicle,
            displayOrder: t.displayOrder,
            isActive: t.isActive,
          }))}
          packages={data.packages.map((p) => ({
            id: p.id,
            name: p.name,
            samplePriceCents: p.prices[0]?.priceCents ?? null,
          }))}
        />
      ) : (
        <div className="card text-sm text-neutral-600">
          Save the loyalty program above first to start adding reward tiers.
        </div>
      )}

      <RedemptionsList rows={data.recentRedemptions} />
    </div>
  );
}
