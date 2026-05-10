'use server';

import { z } from 'zod';
import { RecordPaymentSchema } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { createRefund } from '@/lib/stripe';
import { errs } from '@/lib/errors';

export async function recordPayment(input: z.infer<typeof RecordPaymentSchema>) {
  const parsed = RecordPaymentSchema.parse(input);
  const session = await requireRole(['owner', 'admin', 'staff']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const appt = await tx.appointment.findUniqueOrThrow({ where: { id: parsed.appointmentId } });

    await tx.payment.create({
      data: {
        businessId: session.activeBusinessId,
        appointmentId: appt.id,
        kind: parsed.kind,
        method: parsed.method,
        amountCents: parsed.amountCents,
        currency: 'USD',
        receivedByUserId: session.userId,
        externalReference: parsed.externalReference ?? null,
        notes: parsed.notes ?? null,
      },
    });

    // Recompute balance
    const payments = await tx.payment.findMany({
      where: { appointmentId: appt.id },
      select: { amountCents: true, kind: true },
    });
    const totalPaid = payments
      .filter((p) => p.kind !== 'refund')
      .reduce((s, p) => s + p.amountCents, 0);
    const totalRefunded = payments
      .filter((p) => p.kind === 'refund')
      .reduce((s, p) => s + Math.abs(p.amountCents), 0);
    const netPaid = totalPaid - totalRefunded;
    const balance = Math.max(0, appt.totalCents - netPaid);

    await tx.appointment.update({
      where: { id: appt.id },
      data: {
        balanceDueCents: balance,
        depositPaidCents: payments
          .filter((p) => p.kind === 'deposit')
          .reduce((s, p) => s + p.amountCents, 0),
      },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'create',
      entityType: 'payment',
      entityId: appt.id,
      diff: {
        kind: parsed.kind,
        method: parsed.method,
        amountCents: parsed.amountCents,
      },
    });

    return { ok: true as const, balanceDueCents: balance };
  });
}

const IssueRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  reason: z.string().min(3).max(500),
});

export async function issueRefund(input: z.infer<typeof IssueRefundSchema>) {
  const parsed = IssueRefundSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: parsed.paymentId } });

    // Si fue online via Stripe, emitir refund real
    if (payment.stripePaymentIntentId && payment.method === 'card_online') {
      const refund = await createRefund({
        paymentIntentId: payment.stripePaymentIntentId,
        amountCents: parsed.amountCents,
      });
      await tx.payment.create({
        data: {
          businessId: session.activeBusinessId,
          appointmentId: payment.appointmentId,
          kind: 'refund',
          method: 'card_online',
          amountCents: -parsed.amountCents,
          currency: payment.currency,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          stripeRefundId: refund.id,
          receivedByUserId: session.userId,
          notes: parsed.reason,
        },
      });
    } else {
      // Pago offline — solo registro
      await tx.payment.create({
        data: {
          businessId: session.activeBusinessId,
          appointmentId: payment.appointmentId,
          kind: 'refund',
          method: payment.method,
          amountCents: -parsed.amountCents,
          currency: payment.currency,
          receivedByUserId: session.userId,
          notes: parsed.reason,
        },
      });
    }

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'create',
      entityType: 'refund',
      entityId: payment.id,
      diff: { amountCents: parsed.amountCents, reason: parsed.reason },
    });

    return { ok: true as const };
  });
}
