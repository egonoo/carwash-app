import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { verifyWebhookSignature } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { withoutTenant } from '@/lib/rls';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ ok: false }, { status: 400 });

  const rawBody = await req.text();

  // Connect events vienen firmados con el webhook secret de Connect (si está
  // configurado). Intentamos primero con el secret principal; si falla y hay
  // secret de Connect configurado, reintentamos con ese.
  const primarySecret = process.env.STRIPE_WEBHOOK_SECRET;
  const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!primarySecret && !connectSecret) {
    return NextResponse.json({ ok: false, code: 'NO_WEBHOOK_SECRET' }, { status: 500 });
  }

  let event: Stripe.Event | null = null;
  const secrets = [primarySecret, connectSecret].filter(Boolean) as string[];
  for (const secret of secrets) {
    try {
      event = verifyWebhookSignature(rawBody, signature, secret);
      break;
    } catch {
      // probar el siguiente secret
    }
  }
  if (!event) return NextResponse.json({ ok: false, code: 'BAD_SIGNATURE' }, { status: 400 });

  // Idempotencia: si ya procesamos este event.id, no repetir
  // (usamos audit_log como store — busy/simple; en prod preferir tabla dedicada)
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await onPaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await onPaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await onChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case 'account.updated':
        await onAccountUpdated(event.data.object as Stripe.Account);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('stripe webhook error', event.type, err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function onPaymentSucceeded(pi: Stripe.PaymentIntent) {
  const appointmentId = (pi.metadata?.appointment_id as string | undefined) ?? null;
  const businessId = (pi.metadata?.business_id as string | undefined) ?? null;
  const kind = pi.metadata?.kind as string | undefined;
  if (!appointmentId || !businessId || kind !== 'deposit') return;

  await withoutTenant(async (tx) => {
    // Verificar el appointment pertenece al business
    const appt = await tx.appointment.findFirst({
      where: { id: appointmentId, businessId },
    });
    if (!appt) return;
    if (appt.depositPaidAt) return; // idempotente

    const amountCents = pi.amount_received ?? pi.amount;
    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;

    await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'confirmed',
        confirmedAt: new Date(),
        depositPaidAt: new Date(),
        depositPaidCents: amountCents,
        balanceDueCents: Math.max(0, appt.totalCents - amountCents),
      },
    });

    // Evitar duplicate payment row
    const existing = await tx.payment.findFirst({
      where: { stripePaymentIntentId: pi.id },
    });
    if (!existing) {
      await tx.payment.create({
        data: {
          businessId,
          appointmentId,
          kind: 'deposit',
          method: 'card_online',
          amountCents,
          currency: pi.currency.toUpperCase(),
          stripePaymentIntentId: pi.id,
          stripeChargeId: chargeId ?? null,
        },
      });
    }

    await audit(tx, {
      businessId,
      actorType: 'webhook',
      action: 'update',
      entityType: 'appointment',
      entityId: appointmentId,
      diff: { status: 'confirmed', depositPaidCents: amountCents },
      metadata: { stripeEvent: 'payment_intent.succeeded', paymentIntentId: pi.id },
    });
  });
}

async function onPaymentFailed(pi: Stripe.PaymentIntent) {
  const appointmentId = (pi.metadata?.appointment_id as string | undefined) ?? null;
  const businessId = (pi.metadata?.business_id as string | undefined) ?? null;
  if (!appointmentId || !businessId) return;

  await withoutTenant(async (tx) => {
    await audit(tx, {
      businessId,
      actorType: 'webhook',
      action: 'update',
      entityType: 'appointment',
      entityId: appointmentId,
      metadata: {
        stripeEvent: 'payment_intent.payment_failed',
        last_payment_error: pi.last_payment_error?.message,
      },
    });
  });
}

async function onAccountUpdated(account: Stripe.Account) {
  const accountId = account.id;
  if (!accountId) return;

  await withoutTenant(async (tx) => {
    const business = await tx.business.findFirst({
      where: { stripeAccountId: accountId },
      select: { id: true },
    });
    if (!business) return;

    const chargesEnabled = Boolean(account.charges_enabled);
    const detailsSubmitted = Boolean(account.details_submitted);
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const ready = chargesEnabled && detailsSubmitted;
    const requirementsDue = account.requirements?.currently_due ?? [];
    const disabledReason = account.requirements?.disabled_reason ?? null;

    await tx.business.update({
      where: { id: business.id },
      data: {
        stripeChargesEnabled: chargesEnabled,
        stripeDetailsSubmitted: detailsSubmitted,
        stripePayoutsEnabled: payoutsEnabled,
        stripeAccountReady: ready,
        stripeRequirementsDue: requirementsDue,
        stripeDisabledReason: disabledReason,
      },
    });

    await audit(tx, {
      businessId: business.id,
      actorType: 'webhook',
      action: 'update',
      entityType: 'business',
      entityId: business.id,
      diff: {
        chargesEnabled,
        detailsSubmitted,
        payoutsEnabled,
        ready,
        requirementsDue,
        disabledReason,
      },
      metadata: { stripeEvent: 'account.updated', accountId },
    });
  });
}

async function onChargeRefunded(ch: Stripe.Charge) {
  const piId = typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.id;
  if (!piId) return;

  await withoutTenant(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { stripePaymentIntentId: piId },
    });
    if (!payment) return;

    const refundedCents = ch.amount_refunded ?? 0;
    // crear registro de refund si no existe aún
    const existingRefund = await tx.payment.findFirst({
      where: { appointmentId: payment.appointmentId, kind: 'refund', stripePaymentIntentId: piId },
    });
    if (!existingRefund) {
      await tx.payment.create({
        data: {
          businessId: payment.businessId,
          appointmentId: payment.appointmentId,
          kind: 'refund',
          method: 'card_online',
          amountCents: -refundedCents,
          currency: payment.currency,
          stripePaymentIntentId: piId,
          stripeRefundId: ch.refunds?.data[0]?.id ?? null,
        },
      });
    }

    await audit(tx, {
      businessId: payment.businessId,
      actorType: 'webhook',
      action: 'update',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { stripeEvent: 'charge.refunded', refundedCents },
    });
  });
}
