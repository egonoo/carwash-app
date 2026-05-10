import type { Prisma } from '@splash/db';
import { audit } from '@/lib/audit';

/**
 * Ajuste manual del contador de lealtad de un vehículo. Los triggers DB suben/bajan
 * el contador con el estado de la cita; esto es para corregir manualmente (admin override).
 * Registra la operación en loyalty_adjustment + audit_log.
 */
export async function adjustVehicleLoyaltyCounter(
  tx: Prisma.TransactionClient,
  args: {
    businessId: string;
    vehicleId: string;
    delta: number;          // puede ser negativo
    reason: string;
    adminUserId: string;
  },
): Promise<{ beforeCount: number; afterCount: number }> {
  if (args.delta === 0) throw new Error('DELTA_ZERO');

  // Leer vehicle (para customerId) + progress
  const vehicle = await tx.vehicle.findUniqueOrThrow({
    where: { id: args.vehicleId },
    select: { id: true, businessId: true, customerId: true },
  });
  if (vehicle.businessId !== args.businessId) throw new Error('TENANT_MISMATCH');

  const existing = await tx.loyaltyProgress.findUnique({ where: { vehicleId: args.vehicleId } });
  const beforeCount = existing?.completedVisits ?? 0;
  const afterCount = Math.max(0, beforeCount + args.delta);

  if (existing) {
    await tx.loyaltyProgress.update({
      where: { vehicleId: args.vehicleId },
      data: { completedVisits: afterCount },
    });
  } else {
    await tx.loyaltyProgress.create({
      data: {
        businessId: args.businessId,
        vehicleId: args.vehicleId,
        customerId: vehicle.customerId,
        completedVisits: afterCount,
      },
    });
  }

  const adj = await tx.loyaltyAdjustment.create({
    data: {
      businessId: args.businessId,
      vehicleId: args.vehicleId,
      customerId: vehicle.customerId,
      delta: args.delta,
      reason: args.reason,
      beforeCount,
      afterCount,
      adjustedByUserId: args.adminUserId,
    },
  });

  await audit(tx, {
    businessId: args.businessId,
    actorType: 'user',
    actorUserId: args.adminUserId,
    action: 'adjust',
    entityType: 'loyalty_progress',
    entityId: args.vehicleId,
    diff: { delta: args.delta, beforeCount, afterCount },
    metadata: { reason: args.reason, adjustmentId: adj.id },
  });

  return { beforeCount, afterCount };
}

/**
 * Otorga un descuento de lealtad manualmente (admin). No depende del contador ni de tiers.
 * Inserta un loyalty_redemption con granted_manually=true.
 * Retorna el ID de la redención creada; el caller debe recalcular el breakdown de la cita.
 */
export async function grantManualReward(
  tx: Prisma.TransactionClient,
  args: {
    businessId: string;
    appointmentId: string;
    tierId?: string | null;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    reason: string;
    adminUserId: string;
  },
): Promise<{ redemptionId: string }> {
  const appt = await tx.appointment.findUniqueOrThrow({
    where: { id: args.appointmentId },
    select: {
      id: true,
      businessId: true,
      vehicleId: true,
      customerId: true,
      status: true,
    },
  });
  if (appt.businessId !== args.businessId) throw new Error('TENANT_MISMATCH');

  const progress = await tx.loyaltyProgress.findUnique({
    where: { vehicleId: appt.vehicleId },
    select: { completedVisits: true },
  });

  const red = await tx.loyaltyRedemption.create({
    data: {
      businessId: args.businessId,
      appointmentId: appt.id,
      vehicleId: appt.vehicleId,
      customerId: appt.customerId,
      tierId: args.tierId ?? null,
      tierSnapshot: {
        manual: true,
        discountType: args.discountType,
        discountValue: args.discountValue,
        reason: args.reason,
      } as any,
      visitCountAtRedemption: progress?.completedVisits ?? 0,
      discountType: args.discountType,
      discountValue: args.discountValue,
      discountAppliedCents: 0, // placeholder — el caller re-precisa al recalcular total
      grantedManually: true,
      grantedByUserId: args.adminUserId,
    },
  });

  await tx.appointment.update({
    where: { id: appt.id },
    data: { loyaltyRedemptionId: red.id },
  });

  await audit(tx, {
    businessId: args.businessId,
    actorType: 'user',
    actorUserId: args.adminUserId,
    action: 'grant',
    entityType: 'loyalty_redemption',
    entityId: red.id,
    diff: { manual: true, discountType: args.discountType, discountValue: args.discountValue },
    metadata: { reason: args.reason, appointmentId: appt.id },
  });

  return { redemptionId: red.id };
}
