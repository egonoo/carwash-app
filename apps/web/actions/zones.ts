'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@splash/db';
import { ZoneUpsertSchema, uuid } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { errs } from '@/lib/errors';

async function uniqueZoneSlug(
  tx: Prisma.TransactionClient,
  businessId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'zone';
  let candidate = base;
  for (let n = 2; n < 200; n++) {
    const clash = await tx.zone.findFirst({
      where: {
        businessId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
    const suffix = `-${n}`;
    candidate = base.slice(0, 40 - suffix.length) + suffix;
  }
  throw new Error('Could not generate a unique zone slug');
}

// =============================================================================
// Zones admin actions.
//  - upsertZone: crea o edita. businessId viene del session, nunca del cliente.
//  - toggleZoneActive: on/off sin borrar.
//  - deleteZone: soft delete (archivedAt) si no hay citas asociadas.
// =============================================================================

export async function upsertZone(input: unknown) {
  const session = await requireRole(['owner', 'admin']);
  const parsed = ZoneUpsertSchema.parse(input);

  return withTenant(session.activeBusinessId, async (tx) => {
    let slug: string;
    if (parsed.id) {
      const existing = await tx.zone.findUniqueOrThrow({
        where: { id: parsed.id },
        select: { slug: true },
      });
      slug = existing.slug;
    } else {
      slug = await uniqueZoneSlug(tx, session.activeBusinessId, parsed.name);
    }

    const data = {
      name: parsed.name,
      slug,
      color: parsed.color ?? null,
      description: parsed.description ?? null,
      zipCodes: parsed.zipCodes,
      isActive: parsed.isActive,
      travelTimeMinutes: parsed.travelTimeMinutes ?? null,
      extraFeeCents: parsed.extraFeeCents,
      maxConcurrentJobs: parsed.maxConcurrentJobs,
      displayOrder: parsed.displayOrder,
    };

    const zone = parsed.id
      ? await tx.zone.update({ where: { id: parsed.id }, data })
      : await tx.zone.create({
          data: { businessId: session.activeBusinessId, ...data },
        });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: parsed.id ? 'update' : 'create',
      entityType: 'zone',
      entityId: zone.id,
      diff: data,
    });

    revalidatePath('/zones');
    return { ok: true as const, id: zone.id };
  });
}

const ToggleSchema = z.object({ id: uuid, isActive: z.boolean() });

export async function toggleZoneActive(input: z.infer<typeof ToggleSchema>) {
  const session = await requireRole(['owner', 'admin']);
  const parsed = ToggleSchema.parse(input);

  return withTenant(session.activeBusinessId, async (tx) => {
    const zone = await tx.zone.findUnique({ where: { id: parsed.id }, select: { id: true } });
    if (!zone) throw errs.notFound();
    await tx.zone.update({ where: { id: parsed.id }, data: { isActive: parsed.isActive } });
    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'zone',
      entityId: parsed.id,
      diff: { isActive: parsed.isActive },
    });
    revalidatePath('/zones');
    return { ok: true as const };
  });
}

const DeleteSchema = z.object({ id: uuid });

export async function deleteZone(input: z.infer<typeof DeleteSchema>) {
  const session = await requireRole(['owner', 'admin']);
  const parsed = DeleteSchema.parse(input);

  return withTenant(session.activeBusinessId, async (tx) => {
    const zone = await tx.zone.findUnique({ where: { id: parsed.id }, select: { id: true } });
    if (!zone) throw errs.notFound();

    const apptCount = await tx.appointment.count({ where: { zoneId: parsed.id } });
    if (apptCount > 0) {
      throw errs.validation({
        message: `Cannot delete: ${apptCount} appointment(s) reference this zone. Deactivate it instead.`,
      });
    }

    await tx.zone.update({
      where: { id: parsed.id },
      data: { archivedAt: new Date(), isActive: false },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'delete',
      entityType: 'zone',
      entityId: parsed.id,
    });

    revalidatePath('/zones');
    return { ok: true as const };
  });
}
