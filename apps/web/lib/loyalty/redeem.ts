import type { Prisma, DiscountValueType } from '@splash/db';
import { audit } from '@/lib/audit';

/**
 * Materializa una redención de lealtad en una cita dada. Crea loyalty_redemption,
 * enlaza appointment.loyaltyRedemptionId, escribe audit. Idempotente por (appointment, tier).
 */
export async function redeemLoyaltyForAppointment(
  tx: Prisma.TransactionClient,
  args: {
    businessId: string;
    appointmentId: string;
    vehicleId: string;
    customerId: string;
    tierId: string | null;
    discountType: DiscountValueType;
    discountValue: number;
    discountAppliedCents: number;
    visitCountAtRedemption: number;
    grantedByUserId?: string | null;
    grantedManually?: boolean;
    tierSnapshot: Record<string, unknown>;
  },
): Promise<{ redemptionId: string }> {
  // Idempotencia: si ya existe redemption activa para (appointment, tier), reusar
  if (args.tierId) {
    const existing = await tx.loyaltyRedemption.findUnique({
      where: { appointmentId_tierId: { appointmentId: args.appointmentId, tierId: args.tierId } },
    });
    if (existing && !existing.revokedAt) {
      return { redemptionId: existing.id };
    }
  }

  const red = await tx.loyaltyRedemption.create({
    data: {
      businessId: args.businessId,
      appointmentId: args.appointmentId,
      vehicleId: args.vehicleId,
      customerId: args.customerId,
      tierId: args.tierId,
      tierSnapshot: args.tierSnapshot as any,
      visitCountAtRedemption: args.visitCountAtRedemption,
      discountType: args.discountType,
      discountValue: args.discountValue,
      discountAppliedCents: args.discountAppliedCents,
      grantedManually: args.grantedManually ?? false,
      grantedByUserId: args.grantedByUserId ?? null,
    },
  });

  await tx.appointment.update({
    where: { id: args.appointmentId },
    data: { loyaltyRedemptionId: red.id },
  });

  await audit(tx, {
    businessId: args.businessId,
    actorType: args.grantedByUserId ? 'user' : 'system',
    actorUserId: args.grantedByUserId ?? null,
    action: 'grant',
    entityType: 'loyalty_redemption',
    entityId: red.id,
    diff: { discountAppliedCents: args.discountAppliedCents, tierId: args.tierId },
    metadata: { appointmentId: args.appointmentId, vehicleId: args.vehicleId },
  });

  return { redemptionId: red.id };
}

export async function revokeLoyaltyRedemption(
  tx: Prisma.TransactionClient,
  args: { businessId: string; redemptionId: string; reason: string; userId: string },
): Promise<void> {
  const red = await tx.loyaltyRedemption.findUniqueOrThrow({
    where: { id: args.redemptionId },
  });
  if (red.revokedAt) return;

  await tx.loyaltyRedemption.update({
    where: { id: args.redemptionId },
    data: {
      revokedAt: new Date(),
      revokedByUserId: args.userId,
      revokeReason: args.reason,
    },
  });

  await tx.appointment.updateMany({
    where: { id: red.appointmentId, loyaltyRedemptionId: red.id },
    data: { loyaltyRedemptionId: null },
  });

  await audit(tx, {
    businessId: args.businessId,
    actorType: 'user',
    actorUserId: args.userId,
    action: 'revoke',
    entityType: 'loyalty_redemption',
    entityId: red.id,
    diff: { reason: args.reason },
    metadata: { appointmentId: red.appointmentId },
  });
}
