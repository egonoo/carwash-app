'use server';

import { AppointmentItemKind, Prisma } from '@splash/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { errs } from '@/lib/errors';
import { computePricing, type PricingBreakdown } from '@/lib/pricing/engine';
import { withTenant } from '@/lib/rls';

const AddonInputSchema = z.object({
  addonId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
});

const NewVehicleSchema = z.object({
  vehicleTypeId: z.string().uuid(),
  year: z.number().int().min(1900).max(2100).nullable(),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  color: z.string().max(50).nullable(),
  plate: z.string().max(20).nullable(),
});

const CreateAdminAppointmentSchema = z
  .object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().max(100).nullable(),
    email: z.string().email().max(254),
    phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (e.g. +14155551212)'),
    vehicleId: z.string().uuid().nullable(),
    newVehicle: NewVehicleSchema.nullable(),
    zoneId: z.string().uuid(),
    startsAt: z.string().datetime(),
    durationMinutes: z.number().int().positive().max(8 * 60),
    packageId: z.string().uuid().nullable(),
    addons: z.array(AddonInputSchema).max(20),
    paymentMethod: z.enum(['cash', 'zelle']).nullable(),
  })
  .superRefine((v, ctx) => {
    const hasExisting = v.vehicleId !== null;
    const hasNew = v.newVehicle !== null;
    if (hasExisting === hasNew) {
      ctx.addIssue({
        code: 'custom',
        path: ['vehicleId'],
        message: 'Provide exactly one of vehicleId or newVehicle',
      });
    }
  });

export type CreateAdminAppointmentInput = z.infer<typeof CreateAdminAppointmentSchema>;

export async function createAdminAppointment(
  rawInput: CreateAdminAppointmentInput,
): Promise<void> {
  const input = CreateAdminAppointmentSchema.parse(rawInput);
  const session = await requireRole(['owner', 'admin', 'staff']);

  const appointmentId = await withTenant(
    session.activeBusinessId,
    async (tx): Promise<string> => {
      const business = await tx.business.findUniqueOrThrow({
        where: { id: session.activeBusinessId },
        select: { id: true, depositPolicyType: true, depositPolicyValue: true },
      });

      const customer = await tx.customer.upsert({
        where: { businessId_email: { businessId: business.id, email: input.email } },
        update: {
          phoneE164: input.phoneE164,
          firstName: input.firstName,
          lastName: input.lastName,
        },
        create: {
          businessId: business.id,
          email: input.email,
          phoneE164: input.phoneE164,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      if (customer.blockedAt) throw errs.forbidden('Customer is blocked');

      let vehicleId: string;
      let vehicleTypeId: string;
      if (input.vehicleId) {
        const v = await tx.vehicle.findFirst({
          where: {
            id: input.vehicleId,
            businessId: business.id,
            customerId: customer.id,
            archivedAt: null,
          },
          select: { id: true, vehicleTypeId: true },
        });
        if (!v) {
          throw errs.validation({
            field: 'vehicleId',
            message: 'Selected vehicle does not belong to the customer with this email',
          });
        }
        vehicleId = v.id;
        vehicleTypeId = v.vehicleTypeId;
      } else {
        const nv = input.newVehicle!;
        const vt = await tx.vehicleType.findFirst({
          where: { id: nv.vehicleTypeId, businessId: business.id, archivedAt: null },
          select: { id: true },
        });
        if (!vt) {
          throw errs.validation({
            field: 'newVehicle.vehicleTypeId',
            message: 'Unknown vehicle type',
          });
        }

        const dupe = await tx.vehicle.findFirst({
          where: {
            businessId: business.id,
            customerId: customer.id,
            year: nv.year,
            make: nv.make,
            model: nv.model,
            plate: nv.plate,
            archivedAt: null,
          },
          select: { id: true, vehicleTypeId: true },
        });
        if (dupe) {
          vehicleId = dupe.id;
          vehicleTypeId = dupe.vehicleTypeId;
        } else {
          const created = await tx.vehicle.create({
            data: {
              businessId: business.id,
              customerId: customer.id,
              vehicleTypeId: nv.vehicleTypeId,
              internalCode: generateVehicleCode(),
              year: nv.year,
              make: nv.make,
              model: nv.model,
              color: nv.color,
              plate: nv.plate,
            },
            select: { id: true, vehicleTypeId: true },
          });
          vehicleId = created.id;
          vehicleTypeId = created.vehicleTypeId;
        }
      }

      const zone = await tx.zone.findFirst({
        where: { id: input.zoneId, businessId: business.id, isActive: true, archivedAt: null },
        select: { id: true },
      });
      if (!zone) throw errs.validation({ field: 'zoneId', message: 'Zone not found' });

      let breakdown: PricingBreakdown | null = null;
      if (input.packageId) {
        breakdown = await computePricing(tx, {
          businessId: business.id,
          packageId: input.packageId,
          vehicleTypeId,
          vehicleId,
          zoneId: zone.id,
          addons: input.addons,
        });
      }

      const durationMinutes = breakdown?.durationMinutes ?? input.durationMinutes;
      const startsAt = new Date(input.startsAt);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

      const resources = await tx.resource.findMany({
        where: { businessId: business.id, isActive: true, archivedAt: null },
        orderBy: { displayOrder: 'asc' },
        select: { id: true },
      });
      if (resources.length === 0) {
        throw errs.validation({ message: 'No active resources configured' });
      }

      let chosenResourceId: string | null = null;
      for (const r of resources) {
        const conflict = await tx.appointment.findFirst({
          where: {
            businessId: business.id,
            resourceId: r.id,
            status: { notIn: ['cancelled', 'no_show', 'draft', 'rescheduled'] },
            AND: [{ startsAt: { lt: endsAt } }, { endsAt: { gt: startsAt } }],
          },
          select: { id: true },
        });
        if (!conflict) {
          chosenResourceId = r.id;
          break;
        }
      }
      if (!chosenResourceId) throw errs.slotConflict();

      let createdId: string;
      try {
        const appt = await tx.appointment.create({
          data: {
            businessId: business.id,
            customerId: customer.id,
            vehicleId,
            zoneId: zone.id,
            resourceId: chosenResourceId,
            startsAt,
            endsAt,
            durationMinutes,
            status: 'draft',
            subtotalCents: breakdown?.subtotalCents ?? 0,
            discountTotalCents: breakdown?.discountTotalCents ?? 0,
            taxCents: breakdown?.taxCents ?? 0,
            totalCents: breakdown?.totalCents ?? 0,
            depositPolicyTypeSnapshot:
              breakdown?.depositPolicy.type ?? business.depositPolicyType,
            depositPolicyValueSnapshot:
              breakdown?.depositPolicy.value ?? business.depositPolicyValue,
            depositAmountCents: breakdown?.depositAmountCents ?? 0,
            balanceDueCents: breakdown?.balanceDueOnServiceCents ?? 0,
            depositMethod: input.paymentMethod,
            source: 'admin',
            createdByUserId: session.userId,
          },
          select: { id: true },
        });
        createdId = appt.id;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2010' &&
          (err.meta?.code ?? '') === '23P01'
        ) {
          throw errs.doubleBooking();
        }
        throw err;
      }

      if (breakdown) {
        let displayOrder = 0;
        for (const li of breakdown.lineItems) {
          await tx.appointmentItem.create({
            data: {
              businessId: business.id,
              appointmentId: createdId,
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
              businessId: business.id,
              appointmentId: createdId,
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
      }

      await audit(tx, {
        businessId: business.id,
        actorType: 'user',
        actorUserId: session.userId,
        action: 'create',
        entityType: 'appointment',
        entityId: createdId,
        diff: {
          status: 'draft',
          source: 'admin',
          packageId: input.packageId,
          addonsCount: input.addons.length,
          depositMethod: input.paymentMethod,
          totalCents: breakdown?.totalCents ?? 0,
        },
      });

      return createdId;
    },
  );

  revalidatePath('/appointments');
  redirect(`/appointments/${appointmentId}?uploadPhotos=1`);
}

const PreviewSchema = z.object({
  packageId: z.string().uuid(),
  vehicleTypeId: z.string().uuid(),
  vehicleId: z.string().uuid().nullable(),
  zoneId: z.string().uuid(),
  addons: z.array(AddonInputSchema).max(20),
});

export type AdminPricingPreview = {
  subtotalCents: number;
  discountTotalCents: number;
  taxCents: number;
  totalCents: number;
  depositAmountCents: number;
  balanceDueOnServiceCents: number;
  durationMinutes: number;
};

export async function previewAdminAppointmentPricing(
  rawInput: z.infer<typeof PreviewSchema>,
): Promise<AdminPricingPreview> {
  const input = PreviewSchema.parse(rawInput);
  const session = await requireRole(['owner', 'admin', 'staff']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const vt = await tx.vehicleType.findFirst({
      where: {
        id: input.vehicleTypeId,
        businessId: session.activeBusinessId,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!vt) throw errs.notFound('Vehicle type');

    const breakdown = await computePricing(tx, {
      businessId: session.activeBusinessId,
      packageId: input.packageId,
      vehicleTypeId: input.vehicleTypeId,
      vehicleId: input.vehicleId,
      zoneId: input.zoneId,
      addons: input.addons,
    });

    return {
      subtotalCents: breakdown.subtotalCents,
      discountTotalCents: breakdown.discountTotalCents,
      taxCents: breakdown.taxCents,
      totalCents: breakdown.totalCents,
      depositAmountCents: breakdown.depositAmountCents,
      balanceDueOnServiceCents: breakdown.balanceDueOnServiceCents,
      durationMinutes: breakdown.durationMinutes,
    };
  });
}

function generateVehicleCode(): string {
  const rand = Math.floor(Math.random() * 36 ** 4);
  return `VH-${rand.toString(36).toUpperCase().padStart(4, '0')}`;
}
