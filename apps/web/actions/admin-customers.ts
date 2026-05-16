'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { errs } from '@/lib/errors';
import { audit } from '@/lib/audit';

/**
 * Admin customer-cleanup actions. We do NOT hard-delete Customer rows
 * because they are referenced by appointments, vehicles, payments,
 * evidence photos, loyalty progress and audit logs — a hard delete would
 * cascade through real history.
 *
 * Instead we use the existing `deletedAt` column as a soft-archive flag.
 * Archived customers:
 *   - are hidden from the default customers list
 *   - keep all their appointments and payment history intact
 *   - do NOT free any reserved slots — cancel the appointments separately
 *     if the slot needs to come back
 *   - can be restored at any time
 *
 * The unique indexes on (businessId, email) and (businessId, phoneE164)
 * still apply to archived rows. If a real customer with the same email
 * tries to book again, the booking pipeline's `customer.upsert` re-uses
 * the archived row by id and the deletedAt flag is updated in the bookings
 * action separately if needed. This action only flips the flag — the
 * booking flow is unchanged.
 */

const CustomerIdSchema = z.object({ customerId: z.string().uuid() });

export async function archiveCustomer(
  input: z.infer<typeof CustomerIdSchema>,
): Promise<{ ok: true }> {
  const parsed = CustomerIdSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  await withTenant(session.activeBusinessId, async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: parsed.customerId },
      select: { id: true, businessId: true, deletedAt: true },
    });
    if (!customer || customer.businessId !== session.activeBusinessId) {
      throw errs.notFound('Customer');
    }
    if (customer.deletedAt) {
      // Idempotent — second archive is a no-op.
      return;
    }

    const now = new Date();
    await tx.customer.update({
      where: { id: customer.id },
      data: { deletedAt: now },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'state_change',
      entityType: 'customer',
      entityId: customer.id,
      diff: { archived: true },
    });
  });

  revalidatePath('/customers');
  return { ok: true as const };
}

export async function restoreCustomer(
  input: z.infer<typeof CustomerIdSchema>,
): Promise<{ ok: true }> {
  const parsed = CustomerIdSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  await withTenant(session.activeBusinessId, async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: parsed.customerId },
      select: { id: true, businessId: true, deletedAt: true },
    });
    if (!customer || customer.businessId !== session.activeBusinessId) {
      throw errs.notFound('Customer');
    }
    if (!customer.deletedAt) return;

    await tx.customer.update({
      where: { id: customer.id },
      data: { deletedAt: null },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'state_change',
      entityType: 'customer',
      entityId: customer.id,
      diff: { archived: false },
    });
  });

  revalidatePath('/customers');
  return { ok: true as const };
}
