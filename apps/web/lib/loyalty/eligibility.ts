import type { Prisma } from '@splash/db';

// Mirror of the Prisma DiscountValueType enum. Defined locally so the build
// does not depend on the enum being re-exported by @splash/db.
type DiscountValueType = 'percentage' | 'fixed';

export type LoyaltyEligibility = {
  program: {
    id: string;
    isActive: boolean;
    appliesToAddons: boolean;
    autoApply: boolean;
    countPackagesOnly: boolean;
  } | null;
  currentVisits: number;
  lifetimeRevenueCents: number;
  nextTier: null | {
    tierId: string;
    visitsRequired: number;
    visitsUntilReward: number;
    discountType: DiscountValueType;
    discountValue: number;
    name: string | null;
  };
  rewardAvailable: null | {
    tierId: string;
    name: string | null;
    visitsRequired: number;
    discountType: DiscountValueType;
    discountValue: number;
    maxRedemptionsPerVehicle: number;
    appliesToPackageIds: string[];
  };
};

/**
 * Devuelve información completa de lealtad para la combinación (vehicle, package).
 * Considera programa activo, tiers, progreso del vehículo, redenciones pasadas.
 */
export async function loyaltyEligibility(
  tx: Prisma.TransactionClient,
  args: { businessId: string; vehicleId: string; packageId: string },
): Promise<LoyaltyEligibility> {
  const program = await tx.loyaltyProgram.findUnique({
    where: { businessId: args.businessId },
    include: { tiers: { where: { isActive: true }, orderBy: { visitsRequired: 'asc' } } },
  });

  const progress = await tx.loyaltyProgress.findUnique({
    where: { vehicleId: args.vehicleId },
  });
  const currentVisits = progress?.completedVisits ?? 0;
  const lifetimeRevenueCents = Number(progress?.lifetimeRevenueCents ?? 0n);

  if (!program || !program.isActive || program.tiers.length === 0) {
    return {
      program: null,
      currentVisits,
      lifetimeRevenueCents,
      nextTier: null,
      rewardAvailable: null,
    };
  }

  // Próximo tier no alcanzado aún (informativo)
  const nextTierRow = program.tiers.find((t) => t.visitsRequired > currentVisits) ?? null;
  const nextTier = nextTierRow
    ? {
        tierId: nextTierRow.id,
        visitsRequired: nextTierRow.visitsRequired,
        visitsUntilReward: nextTierRow.visitsRequired - currentVisits,
        discountType: nextTierRow.discountType,
        discountValue: nextTierRow.discountValue,
        name: nextTierRow.name,
      }
    : null;

  // Tiers elegibles para redimir ahora:
  //  - visitsRequired <= currentVisits
  //  - aplica a packageId (o lista vacía = aplica a todos)
  //  - redenciones no consumidas todavía (<= maxRedemptionsPerVehicle)
  const candidates = program.tiers.filter(
    (t) =>
      t.visitsRequired <= currentVisits &&
      (t.appliesToPackageIds.length === 0 || t.appliesToPackageIds.includes(args.packageId)),
  );

  if (!candidates.length) {
    return {
      program: {
        id: program.id,
        isActive: program.isActive,
        appliesToAddons: program.appliesToAddons,
        autoApply: program.autoApply,
        countPackagesOnly: program.countPackagesOnly,
      },
      currentVisits,
      lifetimeRevenueCents,
      nextTier,
      rewardAvailable: null,
    };
  }

  // Cuántas veces se redimió cada tier para este vehículo (contando activas, no revocadas)
  const redemptions = await tx.loyaltyRedemption.groupBy({
    by: ['tierId'],
    where: {
      businessId: args.businessId,
      vehicleId: args.vehicleId,
      revokedAt: null,
      tierId: { in: candidates.map((t) => t.id) },
    },
    _count: { _all: true },
  });
  const usedByTier = new Map(redemptions.map((r) => [r.tierId, r._count._all]));

  // Elegibles: los que aún no agotaron maxRedemptionsPerVehicle
  const stillEligible = candidates.filter((t) => {
    const used = usedByTier.get(t.id) ?? 0;
    return used < t.maxRedemptionsPerVehicle;
  });

  // Elegir el mejor: visitsRequired más alto (asumimos tier más alto = mejor descuento)
  const best = stillEligible.sort((a, b) => b.visitsRequired - a.visitsRequired)[0] ?? null;

  return {
    program: {
      id: program.id,
      isActive: program.isActive,
      appliesToAddons: program.appliesToAddons,
      autoApply: program.autoApply,
      countPackagesOnly: program.countPackagesOnly,
    },
    currentVisits,
    lifetimeRevenueCents,
    nextTier,
    rewardAvailable: best
      ? {
          tierId: best.id,
          name: best.name,
          visitsRequired: best.visitsRequired,
          discountType: best.discountType,
          discountValue: best.discountValue,
          maxRedemptionsPerVehicle: best.maxRedemptionsPerVehicle,
          appliesToPackageIds: best.appliesToPackageIds,
        }
      : null,
  };
}
