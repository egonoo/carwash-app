'use server';

import { AppointmentItemKind } from '@splash/db';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { errs } from '@/lib/errors';
import { computePricing } from '@/lib/pricing/engine';
import { withTenant } from '@/lib/rls';

const SetItemsSchema = z.object({
  appointmentId: z.string().uuid(),
  packageId: z.string().uuid(),
  addons: z
    .array(
      z.object({
        addonId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
      }),
    )
    .max(20),
});

export async function setAppointmentItems(
  input: z.infer<typeof SetItemsSchema>,
): Promise<{ ok: true; totalCents: number }> {
  const parsed = SetItemsSchema.parse(input);
  const session = await requireRole(['owner', 'admin', 'staff']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const appt = await tx.appointment.findUniqueOrThrow({
      where: { id: parsed.appointmentId },
      select: {
        id: true,
        status: true,
        vehicleId: true,
        zoneId: true,
        startsAt: true,
        depositPaidCents: true,
        totalCents: true,
        vehicle: { select: { vehicleTypeId: true } },
      },
    });

    if (appt.status !== 'draft') {
      throw errs.validation({
        message: 'Items can only be edited while the appointment is in draft',
      });
    }

    const breakdown = await computePricing(tx, {
      businessId: session.activeBusinessId,
      packageId: parsed.packageId,
      vehicleTypeId: appt.vehicle.vehicleTypeId,
      vehicleId: appt.vehicleId,
      zoneId: appt.zoneId,
      addons: parsed.addons,
    });

    await tx.appliedDiscount.deleteMany({ where: { appointmentId: appt.id } });
    await tx.appointmentItem.deleteMany({ where: { appointmentId: appt.id } });

    let displayOrder = 0;
    for (const li of breakdown.lineItems) {
      await tx.appointmentItem.create({
        data: {
          businessId: session.activeBusinessId,
          appointmentId: appt.id,
          kind:
            li.kind === 'package'
              ? AppointmentItemKind.package
              : li.kind === 'addon'
                ? AppointmentItemKind.addon
                : AppointmentItemKind.manual_extra,
          refId: li.refId,
          nameSnapshot: li.name,
          descriptionSnapshot: li.description ?? null,
          pricingModeSnapshot: li.pricingMode ?? null,
          unitPriceCents: li.unitPriceCents,
          quantity: li.quantity,
          lineTotalCents: li.lineTotalCents,
          durationMinutes: li.durationMinutes,
          pricingNotes: li.pricingNotes ?? null,
          requiresAdminQuote: li.requiresAdminQuote ?? false,
          createdByUserId: session.userId,
          displayOrder: displayOrder++,
        },
      });
    }

    for (const d of breakdown.discounts) {
      await tx.appliedDiscount.create({
        data: {
          businessId: session.activeBusinessId,
          appointmentId: appt.id,
          kind: d.kind,
          sourceId: d.sourceId,
          label: d.label,
          discountType: d.discountType,
          discountValue: d.discountValue,
          amountCents: d.amountCents,
          snapshot: d.snapshot as any,
        },
      });
    }

    const endsAt = new Date(appt.startsAt.getTime() + breakdown.durationMinutes * 60_000);
    const balanceDueCents = Math.max(0, breakdown.totalCents - appt.depositPaidCents);

    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        durationMinutes: breakdown.durationMinutes,
        endsAt,
        subtotalCents: breakdown.subtotalCents,
        discountTotalCents: breakdown.discountTotalCents,
        taxCents: breakdown.taxCents,
        totalCents: breakdown.totalCents,
        depositAmountCents: breakdown.depositAmountCents,
        depositPolicyTypeSnapshot: breakdown.depositPolicy.type,
        depositPolicyValueSnapshot: breakdown.depositPolicy.value,
        balanceDueCents,
      },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'appointment',
      entityId: appt.id,
      diff: {
        items: { packageId: parsed.packageId, addons: parsed.addons },
        totalBefore: appt.totalCents,
        totalAfter: breakdown.totalCents,
      },
    });

    return { ok: true as const, totalCents: breakdown.totalCents };
  });
}
