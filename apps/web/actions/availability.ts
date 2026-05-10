'use server';

import { revalidatePath } from 'next/cache';
import { fromZonedTime } from 'date-fns-tz';
import { z } from 'zod';
import {
  SaveWorkingHoursSchema,
  SaveBreaksSchema,
  BlockUpsertSchema,
  BlockDeleteSchema,
} from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { errs } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { timeFromHHMM } from '@/lib/availability/time';

// =============================================================================
// Availability admin actions.
// Source of truth for scheduling. businessId is always read from the session
// (never trusted from the client) and writes go through withTenant() so RLS
// enforces tenant isolation on schedule_template / schedule_block.
//
// Note: only async server actions may be exported from this file. Pure
// helpers live in @/lib/availability/time.
// =============================================================================

// ---------------------------------------------------------------------------
// Working hours (kind = 'work')
// ---------------------------------------------------------------------------
export async function saveWorkingHours(input: unknown) {
  const session = await requireRole(['owner', 'admin']);
  const parsed = SaveWorkingHoursSchema.parse(input);

  return withTenant(session.activeBusinessId, async (tx) => {
    // Replace the full week atomically. One row per enabled day.
    await tx.scheduleTemplate.deleteMany({
      where: { businessId: session.activeBusinessId, kind: 'work' },
    });

    const toCreate = parsed.days
      .filter((d) => d.enabled && d.start && d.end)
      .map((d) => ({
        businessId: session.activeBusinessId,
        dayOfWeek: d.dayOfWeek,
        kind: 'work',
        windowStart: timeFromHHMM(d.start!),
        windowEnd: timeFromHHMM(d.end!),
        isActive: true,
      }));

    if (toCreate.length) {
      await tx.scheduleTemplate.createMany({ data: toCreate });
    }

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'schedule_template',
      entityId: session.activeBusinessId, // logical: per-business
      diff: { kind: 'work', days: parsed.days },
    });

    revalidatePath('/availability');
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// Breaks (kind = 'break') — multiple windows per day allowed
// ---------------------------------------------------------------------------
export async function saveBreaks(input: unknown) {
  const session = await requireRole(['owner', 'admin']);
  const parsed = SaveBreaksSchema.parse(input);

  return withTenant(session.activeBusinessId, async (tx) => {
    await tx.scheduleTemplate.deleteMany({
      where: { businessId: session.activeBusinessId, kind: 'break' },
    });

    const toCreate = parsed.days.flatMap((d) =>
      d.windows.map((w) => ({
        businessId: session.activeBusinessId,
        dayOfWeek: d.dayOfWeek,
        kind: 'break',
        windowStart: timeFromHHMM(w.start),
        windowEnd: timeFromHHMM(w.end),
        isActive: true,
      })),
    );

    if (toCreate.length) {
      await tx.scheduleTemplate.createMany({ data: toCreate });
    }

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'schedule_template',
      entityId: session.activeBusinessId,
      diff: { kind: 'break', days: parsed.days },
    });

    revalidatePath('/availability');
    return { ok: true as const };
  });
}

// ---------------------------------------------------------------------------
// Manual blocked time (schedule_block)
// ---------------------------------------------------------------------------
export async function upsertBlock(input: unknown) {
  const session = await requireRole(['owner', 'admin']);
  const parsed = BlockUpsertSchema.parse(input);

  // Resolve business timezone server-side (never trust the client).
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: session.activeBusinessId },
    select: { timezone: true },
  });

  const startHHMM = parsed.allDay ? '00:00' : parsed.start!;
  const endHHMM = parsed.allDay ? '23:59' : parsed.end!;
  const startsAt = fromZonedTime(`${parsed.date}T${startHHMM}:00`, business.timezone);
  const endsAt = fromZonedTime(`${parsed.date}T${endHHMM}:00`, business.timezone);

  if (endsAt <= startsAt) throw errs.validation({ message: 'End must be after start' });

  return withTenant(session.activeBusinessId, async (tx) => {
    if (parsed.id) {
      const existing = await tx.scheduleBlock.findUnique({
        where: { id: parsed.id },
        select: { id: true },
      });
      if (!existing) throw errs.notFound();
      await tx.scheduleBlock.update({
        where: { id: parsed.id },
        data: { startsAt, endsAt, reason: parsed.reason ?? null },
      });
      await audit(tx, {
        businessId: session.activeBusinessId,
        actorType: 'user',
        actorUserId: session.userId,
        action: 'update',
        entityType: 'schedule_block',
        entityId: parsed.id,
        diff: { startsAt, endsAt, reason: parsed.reason ?? null },
      });
      revalidatePath('/availability');
      return { ok: true as const, id: parsed.id };
    }

    const created = await tx.scheduleBlock.create({
      data: {
        businessId: session.activeBusinessId,
        startsAt,
        endsAt,
        reason: parsed.reason ?? null,
        createdBy: session.userId,
      },
    });
    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'create',
      entityType: 'schedule_block',
      entityId: created.id,
      diff: { startsAt, endsAt, reason: parsed.reason ?? null },
    });
    revalidatePath('/availability');
    return { ok: true as const, id: created.id };
  });
}

export async function deleteBlock(input: z.infer<typeof BlockDeleteSchema>) {
  const session = await requireRole(['owner', 'admin']);
  const parsed = BlockDeleteSchema.parse(input);

  return withTenant(session.activeBusinessId, async (tx) => {
    const existing = await tx.scheduleBlock.findUnique({
      where: { id: parsed.id },
      select: { id: true },
    });
    if (!existing) throw errs.notFound();

    await tx.scheduleBlock.delete({ where: { id: parsed.id } });
    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'delete',
      entityType: 'schedule_block',
      entityId: parsed.id,
    });
    revalidatePath('/availability');
    return { ok: true as const };
  });
}
