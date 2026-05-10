'use server';

import { AppointmentStatus } from '@splash/db';
import { z } from 'zod';
import { UpdateAppointmentStatusSchema, AddManualExtraSchema } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { requireRole } from '@/lib/auth';
import { errs } from '@/lib/errors';
import { audit } from '@/lib/audit';
import { computePricing } from '@/lib/pricing/engine';

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  draft: ['pending_deposit', 'cancelled'],
  pending_deposit: ['confirmed', 'cancelled'],
  confirmed: ['on_the_way', 'arrived', 'cancelled', 'no_show', 'rescheduled'],
  on_the_way: ['arrived', 'cancelled', 'no_show'],
  arrived: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: ['cancelled'], // admin override — trigger decrementa lealtad
  cancelled: [],
  no_show: [],
  rescheduled: [],
};

export async function updateAppointmentStatus(
  input: z.infer<typeof UpdateAppointmentStatusSchema>,
): Promise<{ ok: true }> {
  const parsed = UpdateAppointmentStatusSchema.parse(input);
  const session = await requireRole(['owner', 'admin', 'staff']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const appt = await tx.appointment.findUniqueOrThrow({
      where: { id: parsed.appointmentId },
    });

    const allowed = TRANSITIONS[appt.status] ?? [];
    if (!allowed.includes(parsed.newStatus) && !session.isSuperAdmin) {
      throw errs.invalidTransition(appt.status, parsed.newStatus);
    }

    const now = new Date();
    const timestampFields: Partial<Record<string, Date>> = {};
    switch (parsed.newStatus) {
      case 'confirmed':
        timestampFields.confirmedAt = now;
        break;
      case 'on_the_way':
        timestampFields.onTheWayAt = now;
        break;
      case 'arrived':
        timestampFields.arrivedAt = now;
        break;
      case 'in_progress':
        timestampFields.startedAt = now;
        break;
      case 'completed':
        timestampFields.completedAt = now;
        break;
      case 'cancelled':
        timestampFields.cancelledAt = now;
        break;
      case 'no_show':
        timestampFields.noShowAt = now;
        break;
    }

    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: parsed.newStatus,
        ...(parsed.reason && parsed.newStatus === 'cancelled' ? { cancellationReason: parsed.reason } : {}),
        ...(parsed.reason && parsed.newStatus === 'no_show' ? { noShowReason: parsed.reason } : {}),
        ...timestampFields,
      },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'state_change',
      entityType: 'appointment',
      entityId: appt.id,
      diff: { from: appt.status, to: parsed.newStatus, reason: parsed.reason ?? null },
    });

    return { ok: true as const };
  });
}

/**
 * Agrega un line item manual (kind=manual_extra) y recalcula totales. No cambia
 * descuentos existentes (se mantienen los snapshots originales — admin puede
 * ajustar manualmente con discount manual si quiere).
 */
export async function addManualExtra(
  input: z.infer<typeof AddManualExtraSchema>,
): Promise<{ ok: true }> {
  const parsed = AddManualExtraSchema.parse(input);
  const session = await requireRole(['owner', 'admin', 'staff']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const appt = await tx.appointment.findUniqueOrThrow({
      where: { id: parsed.appointmentId },
    });

    if (['cancelled', 'no_show', 'rescheduled'].includes(appt.status)) {
      throw errs.invalidTransition(appt.status, 'add_extra');
    }

    const existingItems = await tx.appointmentItem.findMany({
      where: { appointmentId: appt.id },
      orderBy: { displayOrder: 'asc' },
    });

    // Calcular nuevo subtotal sumando extras existentes + nuevo
    const lineTotal = parsed.priceCents * parsed.quantity;
    const newSubtotal = appt.subtotalCents + lineTotal;
    const discountTotal = appt.discountTotalCents; // unchanged
    const afterDiscount = Math.max(0, newSubtotal - discountTotal);
    const business = await tx.business.findUniqueOrThrow({
      where: { id: session.activeBusinessId },
      select: { taxRateBps: true },
    });
    const newTax = Math.round((afterDiscount * business.taxRateBps) / 10000);
    const newTotal = afterDiscount + newTax;
    const newBalance = Math.max(0, newTotal - appt.depositPaidCents);

    await tx.appointmentItem.create({
      data: {
        businessId: session.activeBusinessId,
        appointmentId: appt.id,
        kind: 'manual_extra',
        refId: null,
        nameSnapshot: parsed.name,
        unitPriceCents: parsed.priceCents,
        quantity: parsed.quantity,
        lineTotalCents: lineTotal,
        durationMinutes: parsed.durationMinutes,
        pricingNotes: parsed.reason ?? null,
        createdByUserId: session.userId,
        displayOrder: existingItems.length,
      },
    });

    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        subtotalCents: newSubtotal,
        taxCents: newTax,
        totalCents: newTotal,
        balanceDueCents: newBalance,
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
        extraAdded: { name: parsed.name, priceCents: parsed.priceCents, qty: parsed.quantity },
        totalBefore: appt.totalCents,
        totalAfter: newTotal,
      },
      metadata: { reason: parsed.reason ?? null },
    });

    return { ok: true as const };
  });
}

export async function recomputePricingForAppointment(
  appointmentId: string,
): Promise<{ ok: true }> {
  const session = await requireRole(['owner', 'admin', 'staff']);
  return withTenant(session.activeBusinessId, async (tx) => {
    const appt = await tx.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    const items = await tx.appointmentItem.findMany({ where: { appointmentId } });

    const pkgItem = items.find((i) => i.kind === 'package');
    const addonItems = items.filter((i) => i.kind === 'addon');
    const manualItems = items.filter((i) => i.kind === 'manual_extra');

    if (!pkgItem?.refId) throw errs.validation({ message: 'No package on appointment' });

    const br = await computePricing(tx, {
      businessId: appt.businessId,
      packageId: pkgItem.refId,
      vehicleTypeId: appt.vehicleId, // not quite — needs vehicle.vehicleTypeId
      vehicleId: appt.vehicleId,
      zoneId: appt.zoneId,
      addons: addonItems
        .filter((i) => i.refId)
        .map((i) => ({ addonId: i.refId!, quantity: i.quantity })),
      manualExtras: manualItems.map((i) => ({
        name: i.nameSnapshot,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
        durationMinutes: i.durationMinutes,
      })),
    });

    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        subtotalCents: br.subtotalCents,
        discountTotalCents: br.discountTotalCents,
        taxCents: br.taxCents,
        totalCents: br.totalCents,
        balanceDueCents: Math.max(0, br.totalCents - appt.depositPaidCents),
      },
    });

    return { ok: true as const };
  });
}
