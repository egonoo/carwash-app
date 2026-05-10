'use server';

import { z } from 'zod';
import { uuid, cents } from '@splash/schemas';
import { revalidatePath } from 'next/cache';
import { withTenant } from '@/lib/rls';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import type { Prisma } from '@splash/db';

// String-literal mirror of the Prisma AddonPricingMode enum. We declare it
// here instead of importing the enum const from @splash/db so the build does
// not depend on Prisma's runtime enum exports being present.
const ADDON_PRICING_MODES = ['fixed', 'starting_at', 'per_unit', 'quote_on_site'] as const;

// ============ Packages ============
const UpsertPackageSchema = z.object({
  id: uuid.optional(),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(1000).optional(),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export async function upsertPackage(input: z.infer<typeof UpsertPackageSchema>) {
  const parsed = UpsertPackageSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);
  return withTenant(session.activeBusinessId, async (tx) => {
    const pkg = parsed.id
      ? await tx.package.update({ where: { id: parsed.id }, data: parsed })
      : await tx.package.create({
          data: { businessId: session.activeBusinessId, ...parsed },
        });
    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: parsed.id ? 'update' : 'create',
      entityType: 'package',
      entityId: pkg.id,
      diff: parsed,
    });
    return { ok: true as const, id: pkg.id };
  });
}

const SetPackagePriceSchema = z.object({
  packageId: uuid,
  vehicleTypeId: uuid,
  priceCents: cents,
  durationMinutes: z.number().int().min(1).max(960),
  isAvailable: z.boolean().default(true),
});

export async function setPackagePrice(input: z.infer<typeof SetPackagePriceSchema>) {
  const parsed = SetPackagePriceSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);
  return withTenant(session.activeBusinessId, async (tx) => {
    await tx.packagePrice.upsert({
      where: {
        packageId_vehicleTypeId: {
          packageId: parsed.packageId,
          vehicleTypeId: parsed.vehicleTypeId,
        },
      },
      update: {
        priceCents: parsed.priceCents,
        durationMinutes: parsed.durationMinutes,
        isAvailable: parsed.isAvailable,
      },
      create: {
        businessId: session.activeBusinessId,
        packageId: parsed.packageId,
        vehicleTypeId: parsed.vehicleTypeId,
        priceCents: parsed.priceCents,
        durationMinutes: parsed.durationMinutes,
        isAvailable: parsed.isAvailable,
      },
    });
    return { ok: true as const };
  });
}

const SaveAdminPackageSchema = z.object({
  packageId: uuid,
  name: z.string().trim().min(2).max(100),
  description: z.string().max(1000).nullable(),
  isActive: z.boolean(),
  prices: z
    .array(
      z.object({
        vehicleTypeId: uuid,
        priceCents: cents,
        durationMinutes: z.number().int().min(1).max(960),
        isAvailable: z.boolean(),
      }),
    )
    .max(50),
});

export async function saveAdminPackage(
  input: z.infer<typeof SaveAdminPackageSchema>,
): Promise<{ ok: true }> {
  const parsed = SaveAdminPackageSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  await withTenant(session.activeBusinessId, async (tx) => {
    const before = await tx.package.findUniqueOrThrow({
      where: { id: parsed.packageId },
      select: { name: true, description: true, isActive: true },
    });

    await tx.package.update({
      where: { id: parsed.packageId },
      data: {
        name: parsed.name,
        description: parsed.description,
        isActive: parsed.isActive,
      },
    });

    for (const price of parsed.prices) {
      await tx.packagePrice.upsert({
        where: {
          packageId_vehicleTypeId: {
            packageId: parsed.packageId,
            vehicleTypeId: price.vehicleTypeId,
          },
        },
        update: {
          priceCents: price.priceCents,
          durationMinutes: price.durationMinutes,
          isAvailable: price.isAvailable,
        },
        create: {
          businessId: session.activeBusinessId,
          packageId: parsed.packageId,
          vehicleTypeId: price.vehicleTypeId,
          priceCents: price.priceCents,
          durationMinutes: price.durationMinutes,
          isAvailable: price.isAvailable,
        },
      });
    }

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'package',
      entityId: parsed.packageId,
      diff: {
        nameBefore: before.name,
        nameAfter: parsed.name,
        descriptionBefore: before.description,
        descriptionAfter: parsed.description,
        isActiveBefore: before.isActive,
        isActiveAfter: parsed.isActive,
        pricesCount: parsed.prices.length,
      },
    });
  });

  revalidatePath('/packages');
  return { ok: true as const };
}

// ============ Addons ============
const UpsertAddonSchema = z.object({
  id: uuid.optional(),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(500).optional(),
  pricingMode: z.enum(ADDON_PRICING_MODES),
  basePriceCents: cents,
  durationMinutes: z.number().int().min(0).max(600),
  defaultQuantity: z.number().int().min(1).default(1),
  maxQuantity: z.number().int().min(1).default(10),
  requiresAdminQuote: z.boolean().default(false),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export async function upsertAddon(input: z.infer<typeof UpsertAddonSchema>) {
  const parsed = UpsertAddonSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);
  return withTenant(session.activeBusinessId, async (tx) => {
    const addon = parsed.id
      ? await tx.addon.update({ where: { id: parsed.id }, data: parsed })
      : await tx.addon.create({
          data: { businessId: session.activeBusinessId, ...parsed },
        });
    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: parsed.id ? 'update' : 'create',
      entityType: 'addon',
      entityId: addon.id,
      diff: parsed,
    });
    return { ok: true as const, id: addon.id };
  });
}

async function uniqueAddonSlug(
  tx: Prisma.TransactionClient,
  businessId: string,
  name: string,
): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'addon';
  let candidate = base;
  for (let n = 2; n < 200; n++) {
    const clash = await tx.addon.findFirst({
      where: { businessId, slug: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
    const suffix = `-${n}`;
    candidate = base.slice(0, 40 - suffix.length) + suffix;
  }
  throw new Error('Could not generate a unique addon slug');
}

const CreateAdminAddonSchema = z.object({
  name: z.string().trim().min(2).max(100),
  pricingMode: z.enum(ADDON_PRICING_MODES),
  basePriceCents: cents.nullable(),
  durationMinutes: z.number().int().min(0).max(600),
  isActive: z.boolean().default(true),
});

export async function createAdminAddon(
  input: z.infer<typeof CreateAdminAddonSchema>,
): Promise<{ ok: true; id: string }> {
  const parsed = CreateAdminAddonSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  const addon = await withTenant(session.activeBusinessId, async (tx) => {
    const slug = await uniqueAddonSlug(tx, session.activeBusinessId, parsed.name);
    const lastOrder = await tx.addon.aggregate({
      where: { businessId: session.activeBusinessId },
      _max: { displayOrder: true },
    });

    const created = await tx.addon.create({
      data: {
        businessId: session.activeBusinessId,
        name: parsed.name,
        slug,
        pricingMode: parsed.pricingMode,
        basePriceCents: parsed.basePriceCents ?? 0,
        durationMinutes: parsed.durationMinutes,
        defaultQuantity: 1,
        maxQuantity: 10,
        requiresAdminQuote: parsed.pricingMode === 'quote_on_site',
        displayOrder: (lastOrder._max.displayOrder ?? -1) + 1,
        isActive: parsed.isActive,
      },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'create',
      entityType: 'addon',
      entityId: created.id,
      diff: parsed,
    });

    return created;
  });

  revalidatePath('/addons');
  return { ok: true as const, id: addon.id };
}

const UpdateAdminAddonSchema = z.object({
  id: uuid,
  name: z.string().trim().min(2).max(100),
  pricingMode: z.enum(ADDON_PRICING_MODES),
  basePriceCents: cents.nullable(),
  durationMinutes: z.number().int().min(0).max(600),
  isActive: z.boolean(),
});

export async function updateAdminAddon(
  input: z.infer<typeof UpdateAdminAddonSchema>,
): Promise<{ ok: true }> {
  const parsed = UpdateAdminAddonSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  await withTenant(session.activeBusinessId, async (tx) => {
    const before = await tx.addon.findUniqueOrThrow({
      where: { id: parsed.id },
      select: {
        name: true,
        pricingMode: true,
        basePriceCents: true,
        durationMinutes: true,
        isActive: true,
      },
    });

    await tx.addon.update({
      where: { id: parsed.id },
      data: {
        name: parsed.name,
        pricingMode: parsed.pricingMode,
        basePriceCents: parsed.basePriceCents ?? 0,
        durationMinutes: parsed.durationMinutes,
        isActive: parsed.isActive,
      },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'addon',
      entityId: parsed.id,
      diff: { before, after: parsed },
    });
  });

  revalidatePath('/addons');
  return { ok: true as const };
}

// ============ Vehicle types ============
const UpsertVehicleTypeSchema = z.object({
  id: uuid.optional(),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(80),
  examples: z.string().max(200).optional(),
  displayOrder: z.number().int().min(0).default(0),
});

export async function upsertVehicleType(input: z.infer<typeof UpsertVehicleTypeSchema>) {
  const parsed = UpsertVehicleTypeSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);
  return withTenant(session.activeBusinessId, async (tx) => {
    const vt = parsed.id
      ? await tx.vehicleType.update({ where: { id: parsed.id }, data: parsed })
      : await tx.vehicleType.create({
          data: { businessId: session.activeBusinessId, ...parsed },
        });
    return { ok: true as const, id: vt.id };
  });
}

// ============ Zones ============
const UpsertZoneSchema = z.object({
  id: uuid.optional(),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(80),
  color: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  zipCodes: z.array(z.string().trim().max(12)).default([]),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

export async function upsertZone(input: z.infer<typeof UpsertZoneSchema>) {
  const parsed = UpsertZoneSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);
  return withTenant(session.activeBusinessId, async (tx) => {
    const z = parsed.id
      ? await tx.zone.update({ where: { id: parsed.id }, data: parsed })
      : await tx.zone.create({
          data: { businessId: session.activeBusinessId, ...parsed },
        });
    return { ok: true as const, id: z.id };
  });
}

// ============ Feature flags (SaaS plan base) ============
const UpdateFeaturesSchema = z.object({
  loyalty: z.boolean().optional(),
  photos: z.boolean().optional(),
  promo_codes: z.boolean().optional(),
  multiple_resources: z.boolean().optional(),
  custom_domain: z.boolean().optional(),
  sms: z.boolean().optional(),
  google_calendar: z.boolean().optional(),
});

export async function updateFeatureFlags(input: z.infer<typeof UpdateFeaturesSchema>) {
  const parsed = UpdateFeaturesSchema.parse(input);
  const session = await requireRole(['owner']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const business = await tx.business.findUniqueOrThrow({
      where: { id: session.activeBusinessId },
      select: { features: true },
    });
    const current = (business.features as Record<string, boolean>) ?? {};
    const merged = { ...current, ...parsed };
    await tx.business.update({
      where: { id: session.activeBusinessId },
      data: { features: merged },
    });
    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'business_features',
      entityId: session.activeBusinessId,
      diff: { before: current, after: merged },
    });
    return { ok: true as const, features: merged };
  });
}

// ============ Deposit policy ============
const UpdateDepositSchema = z.object({
  policyType: z.enum(['fixed', 'percentage']),
  policyValue: z.number().int().min(0),
  minCents: z.number().int().min(0),
});

export async function updateDepositPolicy(input: z.infer<typeof UpdateDepositSchema>) {
  const parsed = UpdateDepositSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);
  return withTenant(session.activeBusinessId, async (tx) => {
    await tx.business.update({
      where: { id: session.activeBusinessId },
      data: {
        depositPolicyType: parsed.policyType,
        depositPolicyValue: parsed.policyValue,
        depositMinCents: parsed.minCents,
      },
    });
    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'deposit_policy',
      entityId: session.activeBusinessId,
      diff: parsed,
    });
    return { ok: true as const };
  });
}
