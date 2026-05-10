'use server';

import { revalidatePath } from 'next/cache';
import { PaymentKind, PaymentMethod } from '@splash/db';
import { requireRole } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { errs } from '@/lib/errors';
import { audit } from '@/lib/audit';

// =============================================================================
// Admin payment actions
//  - confirmZelleDeposit: el admin valida manualmente una transferencia Zelle
//    de depósito y pasa la cita a confirmed.
//  - markBalancePaid: el admin registra el pago final (cash/zelle/card) al
//    terminar el servicio y cierra la cita en completed.
// =============================================================================

export async function confirmZelleDeposit(appointmentId: string) {
  const session = await requireRole(['owner', 'admin', 'staff']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        businessId: true,
        status: true,
        depositStatus: true,
        depositAmountCents: true,
      },
    });
    if (!appt || appt.businessId !== session.activeBusinessId) throw errs.notFound('Appointment');
    if (appt.depositStatus === 'paid') throw errs.depositAlreadyPaid();
    if (appt.status !== 'awaiting_zelle' && appt.status !== 'pending_deposit') {
      throw errs.invalidTransition(appt.status, 'confirmed');
    }

    const now = new Date();

    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'confirmed',
        confirmedAt: now,
        depositStatus: 'paid',
        depositMethod: PaymentMethod.zelle,
        depositPaidCents: appt.depositAmountCents,
        depositPaidAt: now,
      },
    });

    await tx.payment.create({
      data: {
        businessId: session.activeBusinessId,
        appointmentId,
        kind: PaymentKind.deposit,
        method: PaymentMethod.zelle,
        amountCents: appt.depositAmountCents,
        receivedByUserId: session.userId,
        processedAt: now,
      },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'appointment',
      entityId: appointmentId,
      diff: { status: 'confirmed', depositStatus: 'paid', depositMethod: 'zelle' },
    });

    revalidatePath(`/appointments/${appointmentId}`);
    revalidatePath('/appointments');
    revalidatePath('/today');
    return { ok: true as const };
  });
}

type BalanceMethod = 'cash' | 'zelle' | 'card';

function mapBalanceMethod(m: BalanceMethod): PaymentMethod {
  switch (m) {
    case 'cash':
      return PaymentMethod.cash;
    case 'zelle':
      return PaymentMethod.zelle;
    case 'card':
      return PaymentMethod.card_terminal;
  }
}

export async function markBalancePaid(appointmentId: string, method: BalanceMethod) {
  const session = await requireRole(['owner', 'admin', 'staff']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const appt = await tx.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        businessId: true,
        status: true,
        balanceStatus: true,
        balanceDueCents: true,
        depositStatus: true,
      },
    });
    if (!appt || appt.businessId !== session.activeBusinessId) throw errs.notFound('Appointment');
    if (appt.balanceStatus === 'paid') {
      throw errs.invalidTransition('balance_paid', 'balance_paid');
    }
    if (appt.depositStatus !== 'paid') {
      throw errs.invalidTransition(appt.depositStatus, 'balance_paid');
    }

    const pm = mapBalanceMethod(method);
    const now = new Date();

    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'completed',
        completedAt: now,
        balanceStatus: 'paid',
        balanceMethod: pm,
        balancePaidAt: now,
      },
    });

    await tx.payment.create({
      data: {
        businessId: session.activeBusinessId,
        appointmentId,
        kind: PaymentKind.final,
        method: pm,
        amountCents: appt.balanceDueCents,
        receivedByUserId: session.userId,
        processedAt: now,
      },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'appointment',
      entityId: appointmentId,
      diff: { status: 'completed', balanceStatus: 'paid', balanceMethod: method },
    });

    revalidatePath(`/appointments/${appointmentId}`);
    revalidatePath('/appointments');
    revalidatePath('/today');
    return { ok: true as const };
  });
}
