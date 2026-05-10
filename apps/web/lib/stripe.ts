import Stripe from 'stripe';

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required');
  _client = new Stripe(key, { apiVersion: '2024-10-28.acacia', typescript: true });
  return _client;
}

/**
 * Crea PaymentIntent para el depósito de una cita, destinando fondos al connected
 * account del negocio (Stripe Connect Standard).
 */
export async function createDepositIntent(args: {
  amountCents: number;
  currency: string;
  businessId: string;
  appointmentId: string;
  stripeAccountId: string;
  applicationFeeCents?: number;
  customerEmail?: string;
  idempotencyKey: string;
}) {
  if (process.env.DEV_SKIP_STRIPE === '1') {
    const id = `pi_dev_${args.appointmentId.replace(/-/g, '').slice(0, 12)}`;
    return {
      id,
      client_secret: `${id}_secret_dev`,
      amount: args.amountCents,
      currency: args.currency.toLowerCase(),
      status: 'requires_payment_method',
    } as unknown as Stripe.PaymentIntent;
  }
  const stripe = getStripe();
  const intent = await stripe.paymentIntents.create(
    {
      amount: args.amountCents,
      currency: args.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      transfer_data: { destination: args.stripeAccountId },
      ...(args.applicationFeeCents
        ? { application_fee_amount: args.applicationFeeCents }
        : {}),
      receipt_email: args.customerEmail,
      metadata: {
        business_id: args.businessId,
        appointment_id: args.appointmentId,
        kind: 'deposit',
      },
    },
    { idempotencyKey: args.idempotencyKey },
  );
  return intent;
}

export async function createRefund(args: {
  paymentIntentId: string;
  amountCents: number;
  reason?: Stripe.RefundCreateParams.Reason;
}) {
  const stripe = getStripe();
  return stripe.refunds.create({
    payment_intent: args.paymentIntentId,
    amount: args.amountCents,
    ...(args.reason ? { reason: args.reason } : {}),
  });
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
