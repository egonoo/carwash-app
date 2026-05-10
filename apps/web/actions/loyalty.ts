'use server';

import { z } from 'zod';
import {
  LoyaltyProgramUpdateSchema,
  LoyaltyTierUpsertSchema,
  LoyaltyAdjustSchema,
  LoyaltyGrantManualSchema,
} from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { requireRole } from '@/lib/auth';
import { errs } from '@/lib/errors';
import { audit } from '@/lib/audit';
import { adjustVehicleLoyaltyCounter, grantManualReward } from '@/lib/loyalty/override';
import { revokeLoyaltyRedemption } from '@/lib/loyalty/redeem';

/**
 * Actualiza config del programa de lealtad. Crea el programa si no existe.
 */
export async function updateLoyaltyProgram(
  input: z.infer<typeof LoyaltyProgramUpdateSchema>,
): Promise<{ ok: true }> {
  const parsed = LoyaltyProgramUpdateSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const before = await tx.loyaltyProgram.findUnique({
      where: { businessId: session.activeBusinessId },
    });

    const program = await tx.loyaltyProgram.upsert({
      where: { businessId: session.activeBusinessId },
      update: parsed,
      create: {
        businessId: session.activeBusinessId,
        isActive: parsed.isActive ?? false,
        appliesToAddons: parsed.appliesToAddons ?? false,
        countPackagesOnly: parsed.countPackagesOnly ?? true,
        resetOnRedemption: parsed.resetOnRedemption ?? false,
        autoApply: parsed.autoApply ?? true,
        name: parsed.name ?? 'Loyalty Rewards',
        description: parsed.description,
      },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: before ? 'update' : 'create',
      entityType: 'loyalty_program',
      entityId: program.id,
      diff: { before: before ?? null, after: parsed },
    });

    return { ok: true as const };
  });
}

export async function upsertLoyaltyTier(
  input: z.infer<typeof LoyaltyTierUpsertSchema>,
): Promise<{ ok: true; id: string }> {
  const parsed = LoyaltyTierUpsertSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const program = await tx.loyaltyProgram.findUnique({
      where: { businessId: session.activeBusinessId },
    });
    if (!program) throw errs.validation({ message: 'Loyalty program not configured' });

    const tier = parsed.id
      ? await tx.loyaltyTier.update({
          where: { id: parsed.id },
          data: {
            visitsRequired: parsed.visitsRequired,
            discountType: parsed.discountType,
            discountValue: parsed.discountValue,
            appliesToPackageIds: parsed.appliesToPackageIds,
            maxRedemptionsPerVehicle: parsed.maxRedemptionsPerVehicle,
            displayOrder: parsed.displayOrder,
            name: parsed.name,
            isActive: parsed.isActive,
          },
        })
      : await tx.loyaltyTier.create({
          data: {
            programId: program.id,
            businessId: session.activeBusinessId,
            visitsRequired: parsed.visitsRequired,
            discountType: parsed.discountType,
            discountValue: parsed.discountValue,
            appliesToPackageIds: parsed.appliesToPackageIds,
            maxRedemptionsPerVehicle: parsed.maxRedemptionsPerVehicle,
            displayOrder: parsed.displayOrder,
            name: parsed.name,
            isActive: parsed.isActive,
          },
        });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: parsed.id ? 'update' : 'create',
      entityType: 'loyalty_tier',
      entityId: tier.id,
      diff: parsed,
    });

    return { ok: true as const, id: tier.id };
  });
}

export async function deleteLoyaltyTier(tierId: string): Promise<{ ok: true }> {
  const session = await requireRole(['owner', 'admin']);
  return withTenant(session.activeBusinessId, async (tx) => {
    const tier = await tx.loyaltyTier.findUniqueOrThrow({ where: { id: tierId } });
    // Soft: marcar inactivo en vez de hard delete (para mantener histórico de redemptions)
    await tx.loyaltyTier.update({ where: { id: tierId }, data: { isActive: false } });
    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'delete',
      entityType: 'loyalty_tier',
      entityId: tier.id,
    });
    return { ok: true as const };
  });
}

/** Ajuste manual del contador (admin override). */
export async function adjustVehicleCounter(
  input: z.infer<typeof LoyaltyAdjustSchema>,
): Promise<{ ok: true; beforeCount: number; afterCount: number }> {
  const parsed = LoyaltyAdjustSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const result = await adjustVehicleLoyaltyCounter(tx, {
      businessId: session.activeBusinessId,
      vehicleId: parsed.vehicleId,
      delta: parsed.delta,
      reason: parsed.reason,
      adminUserId: session.userId,
    });
    return { ok: true as const, ...result };
  });
}

/** Otorga un descuento de lealtad manualmente sobre una cita. */
export async function grantManualLoyaltyReward(
  input: z.infer<typeof LoyaltyGrantManualSchema>,
): Promise<{ ok: true; redemptionId: string }> {
  const parsed = LoyaltyGrantManualSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const result = await grantManualReward(tx, {
      businessId: session.activeBusinessId,
      appointmentId: parsed.appointmentId,
      tierId: parsed.tierId ?? null,
      discountType: parsed.discountType,
      discountValue: parsed.discountValue,
      reason: parsed.reason,
      adminUserId: session.userId,
    });
    return { ok: true as const, ...result };
  });
}

export async function revokeRedemption(
  redemptionId: string,
  reason: string,
): Promise<{ ok: true }> {
  const session = await requireRole(['owner', 'admin']);
  return withTenant(session.activeBusinessId, async (tx) => {
    await revokeLoyaltyRedemption(tx, {
      businessId: session.activeBusinessId,
      redemptionId,
      reason,
      userId: session.userId,
    });
    return { ok: true as const };
  });
}
