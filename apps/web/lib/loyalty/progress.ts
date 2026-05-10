import { withTenant } from '@/lib/rls';

export type LoyaltyProgressInfo = {
  currentVisits: number;
  remaining: number;
  rewardAvailable: boolean;
  rewardLabel: string;
  message: string;
};

type TierForFormat = { discountType: 'fixed' | 'percentage'; discountValue: number };

function formatReward(t: TierForFormat): string {
  if (t.discountType === 'fixed') {
    return `$${(t.discountValue / 100).toFixed(0)} OFF`;
  }
  if (t.discountValue >= 10000) return 'FREE wash';
  return `${Math.round(t.discountValue / 100)}% OFF`;
}

export async function getVehicleLoyaltyProgress(
  vehicleId: string,
  businessId: string,
): Promise<LoyaltyProgressInfo | null> {
  return withTenant(businessId, async (tx) => {
    const program = await tx.loyaltyProgram.findUnique({
      where: { businessId },
      select: { isActive: true },
    });
    if (!program?.isActive) return null;

    const tiers = await tx.loyaltyTier.findMany({
      where: { businessId, isActive: true },
      orderBy: { visitsRequired: 'asc' },
      select: { visitsRequired: true, discountType: true, discountValue: true },
    });
    if (tiers.length === 0) return null;

    const progress = await tx.loyaltyProgress.findUnique({
      where: { vehicleId },
      select: { completedVisits: true },
    });
    const currentVisits = progress?.completedVisits ?? 0;

    const upcoming = tiers.find((t) => t.visitsRequired - currentVisits >= 0);
    const target = upcoming ?? tiers[tiers.length - 1]!;
    const remaining = upcoming ? upcoming.visitsRequired - currentVisits : 0;

    const rewardLabel = formatReward(target);
    let message: string;
    if (remaining <= 0) {
      message = `🎉 Reward available: ${rewardLabel}`;
    } else if (remaining === 1) {
      message = `Complete 1 more wash to earn ${rewardLabel}`;
    } else {
      message = `Complete ${remaining} more washes to earn ${rewardLabel}`;
    }

    return {
      currentVisits,
      remaining,
      rewardAvailable: remaining <= 0,
      rewardLabel,
      message,
    };
  });
}
