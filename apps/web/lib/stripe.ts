import Stripe from 'stripe';

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (_client) return _client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is required');
  // The Stripe SDK type narrows apiVersion to its newest literal; we keep
  // the runtime version pinned exactly as before via a type-only cast so
  // Stripe behavior is unchanged.
  _client = new Stripe(key, {
    apiVersion: '2024-10-28.acacia' as Stripe.LatestApiVersion,
    typescript: true,
  });
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

/**
 * Fetch an existing deposit PaymentIntent — used to return the original
 * `client_secret` on an idempotent booking retry so the customer can finish
 * a card payment they already started. With Stripe Connect destination
 * charges the PI lives on the platform account, so no stripeAccount header
 * is needed. In dev (DEV_SKIP_STRIPE=1) we synthesize the same shape the
 * create helper produces so the booking flow is testable offline.
 */
export async function retrieveDepositIntent(args: {
  paymentIntentId: string;
  appointmentId: string;
  amountCents: number;
  currency: string;
}) {
  if (process.env.DEV_SKIP_STRIPE === '1') {
    const id = args.paymentIntentId;
    return {
      id,
      client_secret: `${id}_secret_dev`,
      amount: args.amountCents,
      currency: args.currency.toLowerCase(),
      status: 'requires_payment_method',
    } as unknown as Stripe.PaymentIntent;
  }
  const stripe = getStripe();
  return stripe.paymentIntents.retrieve(args.paymentIntentId);
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
