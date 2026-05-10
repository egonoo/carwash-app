'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { withTenant } from '@/lib/rls';

const UpdateBusinessSettingsSchema = z.object({
  name: z.string().trim().min(1).max(100),
  legalName: z.string().trim().max(200).nullable(),
  email: z.string().email().max(254),
  phone: z.string().trim().max(40).nullable(),
  timezone: z.string().trim().min(1).max(80),
  locale: z.string().trim().min(2).max(10),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((s) => s.toUpperCase()),
  taxRateBps: z.number().int().min(0).max(20_000),
});

export type UpdateBusinessSettingsInput = z.infer<typeof UpdateBusinessSettingsSchema>;

export async function updateBusinessSettings(
  input: UpdateBusinessSettingsInput,
): Promise<{ ok: true }> {
  const parsed = UpdateBusinessSettingsSchema.parse(input);
  const session = await requireRole(['owner', 'admin']);

  await withTenant(session.activeBusinessId, async (tx) => {
    const before = await tx.business.findUniqueOrThrow({
      where: { id: session.activeBusinessId },
      select: {
        name: true,
        legalName: true,
        email: true,
        phone: true,
        timezone: true,
        locale: true,
        currency: true,
        taxRateBps: true,
      },
    });

    await tx.business.update({
      where: { id: session.activeBusinessId },
      data: {
        name: parsed.name,
        legalName: parsed.legalName,
        email: parsed.email,
        phone: parsed.phone,
        timezone: parsed.timezone,
        locale: parsed.locale,
        currency: parsed.currency,
        taxRateBps: parsed.taxRateBps,
      },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'business',
      entityId: session.activeBusinessId,
      diff: { before, after: parsed },
    });
  });

  revalidatePath('/settings');
  return { ok: true as const };
}
