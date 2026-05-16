'use server';

import { randomUUID } from 'node:crypto';
import { Prisma } from '@splash/db';
import { BookingDraftInputSchema, type BookingDraftInput } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { errs } from '@/lib/errors';
import { computePricing, type PricingBreakdown } from '@/lib/pricing/engine';
import { computeAvailability } from '@/lib/availability/engine';
import { redeemLoyaltyForAppointment } from '@/lib/loyalty/redeem';
import { createDepositIntent, retrieveDepositIntent } from '@/lib/stripe';
import { audit } from '@/lib/audit';
import {
  EmailTemplate,
  enqueueEmailNotification,
  formatAddress,
  formatAppointmentTime,
  formatMoneyCents,
  formatVehicleLabel,
  markNotificationFailed,
  markNotificationSent,
  renderAdminNewBookingEmail,
  renderBookingReceivedEmail,
  sendEmail,
  type RenderedEmail,
} from '@/lib/email';

// =============================================================================
// createBookingDraft
//  - upsert customer + vehicle
//  - crea appointment (status=pending_deposit)
//  - persiste appointment_item con snapshots
//  - persiste applied_discount si hay loyalty
//  - crea Stripe PaymentIntent
//  - retorna { appointmentId, clientSecret, depositAmountCents, breakdown }
// =============================================================================

export type CreateBookingDraftResult = {
  appointmentId: string;
  depositMethod: 'card' | 'zelle';
  clientSecret: string | null;
  paymentIntentId: string | null;
  depositAmountCents: number;
  totalCents: number;
  balanceDueOnServiceCents: number;
  /**
   * Present only on a fresh create — undefined when an idempotent retry
   * replays an existing appointment. The HTTP route does not propagate this
   * to the client, so an idempotent replay returns the same JSON shape on
   * the wire.
   */
  breakdown?: PricingBreakdown;
  /** True if this response replayed a previously-committed appointment. */
  replayed?: boolean;
};

export async function createBookingDraft(
  rawInput: BookingDraftInput,
): Promise<CreateBookingDraftResult> {
  const input = BookingDraftInputSchema.parse(rawInput);

  // Closure populated inside the transaction (Zelle path only). Dispatched
  // *after* the transaction commits so a Resend failure can never roll back
  // the booking, the appointment row, or the deposit intent.
  const pendingEmails: PendingEmail[] = [];

  // 1. True idempotent retry: if an Appointment already exists with the same
  //    idempotencyKey we *replay* the original response instead of running
  //    the booking pipeline again. This is what protects us from the prior
  //    failure mode where a same-key retry would re-run availability and
  //    surface a SLOT_CONFLICT against the row the first call had just
  //    committed. Replay runs outside withTenant — it only needs cross-cuts
  //    that are safe to query without RLS context (we still scope by
  //    businessId on the row we found).
  const replay = await replayIfIdempotent(input.idempotencyKey, input.businessId);
  if (replay) return replay;

  const result = await withTenant(input.businessId, async (tx) => {
    // 1b. Race-condition double-check inside the tx: another submit with the
    //     same key may have committed between the pre-tx replay lookup and
    //     here. The DB-level uniqueness still guarantees we never insert
    //     twice — see the P2002 catch around appointment.create.
    const concurrentExisting = await tx.appointment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (concurrentExisting) {
      throw errs.idempotency();
    }

    // 2. Business + features
    const business = await tx.business.findUniqueOrThrow({
      where: { id: input.businessId },
      select: {
        id: true,
        slug: true,
        name: true,
        email: true,
        timezone: true,
        currency: true,
        taxRateBps: true,
        depositPolicyType: true,
        depositPolicyValue: true,
        depositMinCents: true,
        features: true,
        evidenceMinPhotos: true,
        stripeAccountId: true,
        stripeAccountReady: true,
      },
    });
    const features = business.features as Record<string, boolean>;

    if (input.depositMethod === 'card' && (!business.stripeAccountId || !business.stripeAccountReady)) {
      throw errs.stripe('Business payment account not fully onboarded');
    }

    // 3. Validar consentimiento
    if (!input.customer.nonRefundableDepositAccepted) {
      throw errs.validation({ field: 'customer.nonRefundableDepositAccepted' });
    }
    if (features.photos && !input.evidenceConsent.currentStateAccepted) {
      throw errs.validation({ field: 'evidenceConsent.currentStateAccepted' });
    }

    // 4. Upsert customer por email (único por negocio). The Customer table
    //    also has @@unique([businessId, phoneE164]); we trap a P2002 on the
    //    phone index and translate it into a field-level VALIDATION_ERROR
    //    so the customer sees a friendly inline message instead of a raw
    //    Prisma string.
    let customer;
    try {
      customer = await tx.customer.upsert({
        where: { businessId_email: { businessId: business.id, email: input.customer.email } },
        update: {
          phoneE164: input.customer.phone,
          firstName: input.customer.firstName,
          lastName: input.customer.lastName ?? null,
          marketingConsent: input.customer.marketingConsent,
          addressLine1Enc: Buffer.from(input.customer.addressLine1),
          addressLine2Enc: input.customer.addressLine2
            ? Buffer.from(input.customer.addressLine2)
            : null,
          addressCity: input.customer.addressCity,
          addressState: input.customer.addressState,
          addressZip: input.customer.addressZip,
          addressLat: input.customer.addressLat ?? null,
          addressLng: input.customer.addressLng ?? null,
        },
        create: {
          businessId: business.id,
          email: input.customer.email,
          phoneE164: input.customer.phone,
          firstName: input.customer.firstName,
          lastName: input.customer.lastName ?? null,
          marketingConsent: input.customer.marketingConsent,
          addressLine1Enc: Buffer.from(input.customer.addressLine1),
          addressLine2Enc: input.customer.addressLine2
            ? Buffer.from(input.customer.addressLine2)
            : null,
          addressCity: input.customer.addressCity,
          addressState: input.customer.addressState,
          addressZip: input.customer.addressZip,
          addressLat: input.customer.addressLat ?? null,
          addressLng: input.customer.addressLng ?? null,
        },
      });
    } catch (err) {
      const conflict = customerConflictHint(err);
      if (conflict) throw conflict;
      throw err;
    }

    if (customer.blockedAt) throw errs.forbidden('Customer blocked');

    // 5. Upsert vehicle — estrategia:
    //    a) Si viene existingVehicleId, verificar que pertenezca al customer.
    //    b) Si viene VIN, buscar por VIN (business, vehicle).
    //    c) Si viene plate+state, buscar por esos.
    //    d) Si nada, crear nuevo con internal_code generado.
    let vehicleId: string;
    if (input.vehicle.existingVehicleId) {
      const v = await tx.vehicle.findFirst({
        where: {
          id: input.vehicle.existingVehicleId,
          businessId: business.id,
          customerId: customer.id,
        },
      });
      if (!v) throw errs.notFound('Vehicle');
      vehicleId = v.id;
    } else {
      let found = null as Awaited<ReturnType<typeof tx.vehicle.findFirst>>;
      if (input.vehicle.vin) {
        found = await tx.vehicle.findFirst({
          where: { businessId: business.id, customerId: customer.id, vin: input.vehicle.vin },
        });
      }
      if (!found && input.vehicle.plate && input.vehicle.plateState) {
        found = await tx.vehicle.findFirst({
          where: {
            businessId: business.id,
            customerId: customer.id,
            plate: input.vehicle.plate,
            plateState: input.vehicle.plateState,
          },
        });
      }
      if (found) {
        vehicleId = found.id;
      } else {
        const internalCode = generateVehicleCode();
        try {
          const created = await tx.vehicle.create({
            data: {
              businessId: business.id,
              customerId: customer.id,
              vehicleTypeId: input.vehicle.vehicleTypeId,
              internalCode,
              vin: input.vehicle.vin ?? null,
              plate: input.vehicle.plate ?? null,
              plateState: input.vehicle.plateState ?? null,
              make: input.vehicle.make ?? null,
              model: input.vehicle.model ?? null,
              year: input.vehicle.year ?? null,
              color: input.vehicle.color ?? null,
              nickname: input.vehicle.nickname ?? null,
            },
          });
          vehicleId = created.id;
        } catch (err) {
          const conflict = vehicleConflictHint(err);
          if (conflict) throw conflict;
          throw err;
        }
      }
    }

    // 6. Calcular pricing
    const breakdown = await computePricing(tx, {
      businessId: business.id,
      packageId: input.packageId,
      vehicleTypeId: input.vehicle.vehicleTypeId,
      vehicleId,
      zoneId: input.zoneId,
      addons: input.addons,
      promoCode: input.promoCode ?? null,
    });

    // 7. Resolver fechas + validar disponibilidad server-side
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + breakdown.durationMinutes * 60_000);

    // Re-run the availability engine server-side. This is the authoritative
    // gate: the public client cannot bypass working hours, breaks, manual
    // blocked time, zone-active days, travel time or existing appointments
    // by manipulating the request — the engine enforces all of them. The
    // EXCLUDE constraint on appointment remains as a final race-condition
    // safety net.
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: business.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(startsAt);

    const slots = await computeAvailability(tx, {
      businessId: business.id,
      zoneId: input.zoneId,
      date: localDate,
      packageId: input.packageId,
      vehicleTypeId: input.vehicle.vehicleTypeId,
      addonIds: input.addons.map((a) => a.addonId),
      timezone: business.timezone,
    });

    const startMs = startsAt.getTime();
    const matchingSlot = slots.find((s) => s.startsAt.getTime() === startMs);
    if (!matchingSlot) throw errs.slotConflict();
    const chosenResourceId = matchingSlot.resourceId;

    // 8. Insertar appointment. El EXCLUDE constraint actúa como red de
    //    seguridad ante race conditions. Status inicial depende del método:
    //      card  → pending_deposit (Stripe aún no capturado)
    //      zelle → awaiting_zelle  (esperando validación manual)
    const apptStatus = input.depositMethod === 'zelle' ? 'awaiting_zelle' : 'pending_deposit';
    const depositStatus = input.depositMethod === 'zelle' ? 'awaiting_zelle' : 'pending';
    const depositMethod = input.depositMethod === 'zelle' ? 'zelle' : 'card_online';
    let appointment;
    try {
      appointment = await tx.appointment.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          vehicleId,
          zoneId: input.zoneId,
          resourceId: chosenResourceId,
          startsAt,
          endsAt,
          durationMinutes: breakdown.durationMinutes,
          status: apptStatus,
          depositStatus,
          depositMethod,
          serviceAddressLine1Enc: Buffer.from(input.customer.addressLine1),
          serviceAddressLine2Enc: input.customer.addressLine2
            ? Buffer.from(input.customer.addressLine2)
            : null,
          serviceAddressCity: input.customer.addressCity,
          serviceAddressState: input.customer.addressState,
          serviceAddressZip: input.customer.addressZip,
          serviceAddressLat: input.customer.addressLat ?? null,
          serviceAddressLng: input.customer.addressLng ?? null,
          customerInstructions: input.customer.customerInstructions ?? null,
          subtotalCents: breakdown.subtotalCents,
          discountTotalCents: breakdown.discountTotalCents,
          taxCents: breakdown.taxCents,
          totalCents: breakdown.totalCents,
          depositPolicyTypeSnapshot: breakdown.depositPolicy.type,
          depositPolicyValueSnapshot: breakdown.depositPolicy.value,
          depositAmountCents: breakdown.depositAmountCents,
          balanceDueCents: breakdown.balanceDueOnServiceCents,
          idempotencyKey: input.idempotencyKey,
          source: 'web',
        },
      });
    } catch (err) {
      // Structural check — avoids depending on Prisma.PrismaClientKnownRequestError
      // being exported as a runtime value. P2010+meta.code='23P01' is the EXCLUDE
      // overlap conflict; P2002 is the idempotency-key uniqueness violation.
      const e = err as { code?: string; meta?: { code?: unknown } };
      if (e.code === 'P2010' && (e.meta?.code ?? '') === '23P01') {
        throw errs.doubleBooking();
      }
      if (e.code === 'P2002') {
        throw errs.idempotency();
      }
      throw err;
    }

    // 9. Persistir items (snapshots)
    let displayOrder = 0;
    for (const li of breakdown.lineItems) {
      await tx.appointmentItem.create({
        data: {
          businessId: business.id,
          appointmentId: appointment.id,
          kind:
            li.kind === 'package'
              ? 'package'
              : li.kind === 'addon'
                ? 'addon'
                : 'manual_extra',
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
          displayOrder: displayOrder++,
        },
      });
    }

    // 10. Descuentos aplicados
    for (const d of breakdown.discounts) {
      await tx.appliedDiscount.create({
        data: {
          businessId: business.id,
          appointmentId: appointment.id,
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

    // 11. Redención de lealtad si hay
    const loyaltyDiscount = breakdown.discounts.find((d) => d.kind === 'loyalty');
    if (loyaltyDiscount && breakdown.loyalty?.rewardAvailable) {
      await redeemLoyaltyForAppointment(tx, {
        businessId: business.id,
        appointmentId: appointment.id,
        vehicleId,
        customerId: customer.id,
        tierId: breakdown.loyalty.rewardAvailable.tierId,
        discountType: breakdown.loyalty.rewardAvailable.discountType,
        discountValue: breakdown.loyalty.rewardAvailable.discountValue,
        discountAppliedCents: loyaltyDiscount.amountCents,
        visitCountAtRedemption: breakdown.loyalty.currentVisits,
        tierSnapshot: loyaltyDiscount.snapshot,
      });
    }

    // 12. Consentimiento de evidencia
    if (features.photos) {
      await tx.evidenceConsent.upsert({
        where: { appointmentId: appointment.id },
        update: {},
        create: {
          businessId: business.id,
          appointmentId: appointment.id,
          customerId: customer.id,
          currentStateAccepted: true,
          currentStateTextVersion: 'v1',
          currentStateAcceptedAt: new Date(),
          nonRefundableDepositAccepted: true,
          nonRefundableTextVersion: 'v1',
          nonRefundableAcceptedAt: new Date(),
          marketingUseConsent: input.evidenceConsent.marketingUseConsent,
          marketingTextVersion: input.evidenceConsent.marketingUseConsent ? 'v1' : null,
          marketingAcceptedAt: input.evidenceConsent.marketingUseConsent ? new Date() : null,
        },
      });
    }

    // 13. Audit log
    await audit(tx, {
      businessId: business.id,
      actorType: 'customer',
      actorCustomerId: customer.id,
      action: 'create',
      entityType: 'appointment',
      entityId: appointment.id,
      diff: {
        status: apptStatus,
        depositMethod,
        totalCents: breakdown.totalCents,
        depositAmountCents: breakdown.depositAmountCents,
      },
    });

    // 14. Stripe PaymentIntent — solo si el método es tarjeta.
    //     Para Zelle no se cobra automáticamente; el admin confirma cuando
    //     verifica la transferencia vía confirmZelleDeposit().
    if (input.depositMethod === 'zelle') {
      // 14a. Enqueue Zelle notifications inside the transaction so they
      //      commit (or roll back) atomically with the appointment. Actual
      //      Resend dispatch happens *after* withTenant resolves — see the
      //      pendingEmails loop below the transaction. Dedup on retry is
      //      provided by Appointment.idempotencyKey (P2002 thrown above
      //      before we ever reach this branch on a re-submit).
      await enqueueZelleBookingEmails(tx, {
        business,
        customer,
        appointment,
        breakdown,
        zoneId: input.zoneId,
        vehicleSnapshot: {
          year: input.vehicle.year ?? null,
          make: input.vehicle.make ?? null,
          model: input.vehicle.model ?? null,
          color: input.vehicle.color ?? null,
          nickname: input.vehicle.nickname ?? null,
        },
        addressLine1: input.customer.addressLine1,
        addressLine2: input.customer.addressLine2 ?? null,
        addressCity: input.customer.addressCity,
        addressState: input.customer.addressState,
        addressZip: input.customer.addressZip,
        pendingEmails,
      });

      return {
        appointmentId: appointment.id,
        depositMethod: 'zelle' as const,
        clientSecret: null,
        paymentIntentId: null,
        depositAmountCents: breakdown.depositAmountCents,
        totalCents: breakdown.totalCents,
        balanceDueOnServiceCents: breakdown.balanceDueOnServiceCents,
        breakdown,
      };
    }

    const intent = await createDepositIntent({
      amountCents: breakdown.depositAmountCents,
      currency: business.currency,
      businessId: business.id,
      appointmentId: appointment.id,
      stripeAccountId: business.stripeAccountId!,
      customerEmail: input.customer.email,
      idempotencyKey: `deposit_${appointment.id}`,
    });

    await tx.appointment.update({
      where: { id: appointment.id },
      data: { depositStripePaymentIntentId: intent.id },
    });

    if (!intent.client_secret) throw errs.stripe('PaymentIntent missing client_secret');

    return {
      appointmentId: appointment.id,
      depositMethod: 'card' as const,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      depositAmountCents: breakdown.depositAmountCents,
      totalCents: breakdown.totalCents,
      balanceDueOnServiceCents: breakdown.balanceDueOnServiceCents,
      breakdown,
    };
  });

  // Post-commit: send any queued Zelle emails. Failures here MUST NOT throw —
  // the booking has already been persisted and a Resend outage cannot undo
  // it. Each notification row is updated to `sent` or `failed` so the admin
  // can later retry from a queue worker.
  if (pendingEmails.length > 0) {
    await dispatchPendingEmails(pendingEmails);
  }

  return result;
}

// --------------------- helpers ---------------------

/**
 * Look up an Appointment by idempotency key and, if one exists, build the
 * same success payload the original create call returned. Card path
 * re-fetches the deposit PaymentIntent so the customer can finish paying;
 * Zelle path replays the original "send Zelle" instructions. Notifications
 * are NOT re-enqueued — the originals were committed inside the first
 * transaction. Returns null if no replay is needed.
 */
async function replayIfIdempotent(
  idempotencyKey: string,
  businessId: string,
): Promise<CreateBookingDraftResult | null> {
  const { prisma } = await import('@/lib/db');
  const existing = await prisma.appointment.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      businessId: true,
      depositMethod: true,
      depositStripePaymentIntentId: true,
      depositAmountCents: true,
      totalCents: true,
      balanceDueCents: true,
      business: { select: { currency: true } },
    },
  });

  if (!existing) return null;
  // Defense in depth: never replay across tenants. With UUIDv4 keys this is
  // a non-issue but a same-key collision should fall through to the normal
  // path instead of leaking a foreign tenant's data.
  if (existing.businessId !== businessId) return null;

  if (existing.depositMethod === 'zelle') {
    return {
      appointmentId: existing.id,
      depositMethod: 'zelle',
      clientSecret: null,
      paymentIntentId: null,
      depositAmountCents: existing.depositAmountCents,
      totalCents: existing.totalCents,
      balanceDueOnServiceCents: existing.balanceDueCents,
      replayed: true,
    };
  }

  // Card path: must have a PaymentIntent id to return a client_secret.
  if (!existing.depositStripePaymentIntentId) {
    // Anomalous state — every committed card appointment should also have
    // a PI id (the create-then-update happens in the same tx). Bail out
    // and let the caller surface IDEMPOTENCY_MISMATCH rather than guess.
    throw errs.idempotency();
  }

  const intent = await retrieveDepositIntent({
    paymentIntentId: existing.depositStripePaymentIntentId,
    appointmentId: existing.id,
    amountCents: existing.depositAmountCents,
    currency: existing.business.currency,
  });

  return {
    appointmentId: existing.id,
    depositMethod: 'card',
    clientSecret: intent.client_secret ?? null,
    paymentIntentId: existing.depositStripePaymentIntentId,
    depositAmountCents: existing.depositAmountCents,
    totalCents: existing.totalCents,
    balanceDueOnServiceCents: existing.balanceDueCents,
    replayed: true,
  };
}

/** Best-effort detection of a Prisma P2002 target containing a substring. */
function targetIncludes(meta: { target?: unknown } | undefined, needle: string): boolean {
  const t = meta?.target;
  if (Array.isArray(t)) return t.some((s) => typeof s === 'string' && s.includes(needle));
  if (typeof t === 'string') return t.includes(needle);
  return false;
}

/**
 * Translate a Prisma P2002 on the Customer table into a friendly
 * VALIDATION_ERROR. Returns null if the error isn't a recognized customer
 * conflict — caller should rethrow the original.
 */
function customerConflictHint(err: unknown): unknown | null {
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e.code !== 'P2002') return null;
  if (targetIncludes(e.meta, 'phone')) {
    return errs.validation({
      fieldErrors: {
        'customer.phone': [
          'This phone number is already linked to another customer at this business. Use a different phone or contact us if this looks wrong.',
        ],
      },
    });
  }
  if (targetIncludes(e.meta, 'email')) {
    return errs.validation({
      fieldErrors: {
        'customer.email': [
          'We could not save this email. Please double-check it and try again, or contact us for help.',
        ],
      },
    });
  }
  // Fallback friendly message — still better than leaking the raw Prisma text.
  return errs.validation({
    fieldErrors: {
      'customer.email': [
        'We could not save your contact details. Please review your name, email and phone and try again.',
      ],
    },
  });
}

/**
 * Translate a Prisma P2002 on the Vehicle table into a friendly
 * VALIDATION_ERROR. Covers VIN and plate+state partial-unique indexes.
 */
function vehicleConflictHint(err: unknown): unknown | null {
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e.code !== 'P2002') return null;
  if (targetIncludes(e.meta, 'vin')) {
    return errs.validation({
      fieldErrors: {
        'vehicle.vin': [
          'This VIN is already on file for another customer at this business. Leave VIN blank if you are unsure, or contact us.',
        ],
      },
    });
  }
  if (targetIncludes(e.meta, 'plate')) {
    return errs.validation({
      fieldErrors: {
        'vehicle.plate': [
          'This license plate is already on file for another customer at this business. Leave plate blank if you are booking a different car, or contact us.',
        ],
      },
    });
  }
  return errs.validation({
    fieldErrors: {
      'vehicle.plate': [
        'We could not save the vehicle details. Please review the plate and VIN and try again.',
      ],
    },
  });
}

function generateVehicleCode(): string {
  // VH-XXXX donde XXXX es base36 random (uppercase) — legible y suficiente anti-colisión por tenant
  const rand = Math.floor(Math.random() * 36 ** 4);
  return `VH-${rand.toString(36).toUpperCase().padStart(4, '0')}`;
}

// =============================================================================
// Email wiring (Phase 2 — Zelle path only).
// =============================================================================

type PendingEmail = {
  notificationId: string;
  to: string;
  rendered: RenderedEmail;
  template: string;
  appointmentId: string;
};

type EnqueueZelleArgs = {
  business: {
    id: string;
    slug: string;
    name: string;
    email: string;
    timezone: string;
    currency: string;
  };
  customer: { id: string; email: string; firstName: string; lastName: string | null; phoneE164: string };
  appointment: { id: string; startsAt: Date };
  breakdown: PricingBreakdown;
  zoneId: string;
  vehicleSnapshot: {
    year: number | null;
    make: string | null;
    model: string | null;
    color: string | null;
    nickname: string | null;
  };
  addressLine1: string;
  addressLine2: string | null;
  addressCity: string;
  addressState: string;
  addressZip: string;
  pendingEmails: PendingEmail[];
};

async function enqueueZelleBookingEmails(
  tx: Prisma.TransactionClient,
  args: EnqueueZelleArgs,
): Promise<void> {
  const {
    business,
    customer,
    appointment,
    breakdown,
    zoneId,
    vehicleSnapshot,
    addressLine1,
    addressLine2,
    addressCity,
    addressState,
    addressZip,
    pendingEmails,
  } = args;

  const zone = await tx.zone.findUnique({
    where: { id: zoneId },
    select: { name: true },
  });

  const packageItem = breakdown.lineItems.find((li) => li.kind === 'package');
  const addonItems = breakdown.lineItems.filter((li) => li.kind === 'addon');

  const packageName = packageItem?.name ?? 'Service';
  const addonsLabel = addonItems.map((li) => li.name).join(', ');
  const vehicleLabel = formatVehicleLabel(vehicleSnapshot);

  const appointmentWhen = formatAppointmentTime(appointment.startsAt, business.timezone);
  const totalFormatted = formatMoneyCents(breakdown.totalCents, business.currency);
  const depositFormatted = formatMoneyCents(breakdown.depositAmountCents, business.currency);
  const balanceFormatted = formatMoneyCents(breakdown.balanceDueOnServiceCents, business.currency);
  const customerServiceAddress = formatAddress({
    line1: addressLine1,
    line2: addressLine2,
    city: addressCity,
    state: addressState,
    zip: addressZip,
  });

  // ----- Customer "we got your booking — send Zelle to confirm" -----
  const customerNotif = await enqueueEmailNotification(tx, {
    businessId: business.id,
    appointmentId: appointment.id,
    customerId: customer.id,
    template: EmailTemplate.BookingReceived,
    payload: {
      variant: 'awaiting_zelle',
      to: customer.email,
      subject_seed: `${business.name}|${appointment.id}`,
    },
  });
  pendingEmails.push({
    notificationId: customerNotif.id,
    to: customer.email,
    appointmentId: appointment.id,
    template: EmailTemplate.BookingReceived,
    rendered: renderBookingReceivedEmail({
      customerFirstName: customer.firstName,
      businessName: business.name,
      appointmentWhen,
      packageName,
      vehicleLabel,
      serviceAddress: customerServiceAddress,
      totalFormatted,
      depositFormatted,
      balanceFormatted,
      depositMethod: 'zelle',
      zelle: {
        handle: `payments@${business.slug}.splash.app`,
        memo: appointment.id.slice(0, 8),
      },
    }),
  });

  // ----- Admin "new booking — verify Zelle when it lands" -----
  const adminNotif = await enqueueEmailNotification(tx, {
    businessId: business.id,
    appointmentId: appointment.id,
    template: EmailTemplate.AdminNewBooking,
    payload: {
      variant: 'awaiting_zelle',
      to: business.email,
    },
  });
  pendingEmails.push({
    notificationId: adminNotif.id,
    to: business.email,
    appointmentId: appointment.id,
    template: EmailTemplate.AdminNewBooking,
    rendered: renderAdminNewBookingEmail({
      businessName: business.name,
      state: 'awaiting_zelle',
      customerName: [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim(),
      customerEmail: customer.email,
      customerPhone: customer.phoneE164,
      appointmentWhen,
      packageName,
      addonsLabel: addonsLabel || undefined,
      vehicleLabel,
      zoneName: zone?.name ?? '',
      serviceAddress: customerServiceAddress,
      totalFormatted,
      depositFormatted,
      depositMethod: 'zelle',
      appointmentUrl: buildAdminAppointmentUrl(appointment.id),
    }),
  });
}

async function dispatchPendingEmails(pending: PendingEmail[]): Promise<void> {
  await Promise.all(
    pending.map(async (p) => {
      // Resend's idempotency key dedups retries to its API; the notification
      // id is stable for the lifetime of the row, so re-running a worker
      // against the same queued row will not double-deliver.
      const res = await sendEmail({
        to: p.to,
        subject: p.rendered.subject,
        html: p.rendered.html,
        text: p.rendered.text,
        idempotencyKey: `notif_${p.notificationId}`,
        tags: [
          { name: 'template', value: p.template.replace(/[^a-zA-Z0-9_-]/g, '_') },
          { name: 'appointment', value: p.appointmentId },
        ],
      });

      try {
        if (res.ok) {
          await markNotificationSent(p.notificationId, res.id);
        } else {
          await markNotificationFailed(p.notificationId, res.error);
        }
      } catch (err) {
        // Last-ditch: never let a status-update failure escape and surface to
        // the booking caller. Log and move on; the row stays in `queued` and
        // a future queue worker can pick it back up.
        console.error('[email] failed to update notification status', {
          notificationId: p.notificationId,
          err: (err as Error).message,
        });
      }
    }),
  );
}

function buildAdminAppointmentUrl(appointmentId: string): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) return undefined;
  return `${base.replace(/\/$/, '')}/appointments/${appointmentId}`;
}
