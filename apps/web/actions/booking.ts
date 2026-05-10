'use server';

import { randomUUID } from 'node:crypto';
import { Prisma, AppointmentItemKind } from '@splash/db';
import { BookingDraftInputSchema, type BookingDraftInput } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { errs } from '@/lib/errors';
import { computePricing, type PricingBreakdown } from '@/lib/pricing/engine';
import { computeAvailability } from '@/lib/availability/engine';
import { redeemLoyaltyForAppointment } from '@/lib/loyalty/redeem';
import { createDepositIntent } from '@/lib/stripe';
import { audit } from '@/lib/audit';

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
  breakdown: PricingBreakdown;
};

export async function createBookingDraft(
  rawInput: BookingDraftInput,
): Promise<CreateBookingDraftResult> {
  const input = BookingDraftInputSchema.parse(rawInput);

  return withTenant(input.businessId, async (tx) => {
    // 1. Idempotencia: si ya existe appointment con esta idempotencyKey, devolverlo.
    const existing = await tx.appointment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: {
        id: true,
        depositAmountCents: true,
        totalCents: true,
        balanceDueCents: true,
        depositStripePaymentIntentId: true,
      },
    });
    if (existing && existing.depositStripePaymentIntentId) {
      const stripeKey = `ci:${existing.depositStripePaymentIntentId}`;
      // devolvemos datos mínimos — el frontend puede retomar.
      // idealmente, retrieve del stripe para traer el client_secret.
      throw errs.idempotency();
    }

    // 2. Business + features
    const business = await tx.business.findUniqueOrThrow({
      where: { id: input.businessId },
      select: {
        id: true,
        slug: true,
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

    // 4. Upsert customer por email (único por negocio)
    const customer = await tx.customer.upsert({
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
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2010' && (err.meta?.code ?? '') === '23P01') {
          throw errs.doubleBooking();
        }
        if (err.code === 'P2002') {
          throw errs.idempotency();
        }
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
}

// --------------------- helpers ---------------------
function generateVehicleCode(): string {
  // VH-XXXX donde XXXX es base36 random (uppercase) — legible y suficiente anti-colisión por tenant
  const rand = Math.floor(Math.random() * 36 ** 4);
  return `VH-${rand.toString(36).toUpperCase().padStart(4, '0')}`;
}
