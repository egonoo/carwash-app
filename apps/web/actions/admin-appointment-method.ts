'use server';

import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { errs } from '@/lib/errors';
import { withTenant } from '@/lib/rls';

const SetMethodSchema = z.object({
  appointmentId: z.string().uuid(),
  method: z.enum(['cash', 'zelle']),
});

export async function setAdminDepositMethod(
  input: z.infer<typeof SetMethodSchema>,
): Promise<{ ok: true }> {
  const parsed = SetMethodSchema.parse(input);
  const session = await requireRole(['owner', 'admin', 'staff']);

  return withTenant(session.activeBusinessId, async (tx) => {
    const appt = await tx.appointment.findUniqueOrThrow({
      where: { id: parsed.appointmentId },
      select: { id: true, status: true, depositMethod: true },
    });

    if (appt.status !== 'draft') {
      throw errs.validation({
        message: 'Deposit method can only be set while the appointment is in draft',
      });
    }

    await tx.appointment.update({
      where: { id: appt.id },
      data: { depositMethod: parsed.method },
    });

    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'appointment',
      entityId: appt.id,
      diff: { depositMethodFrom: appt.depositMethod ?? null, depositMethodTo: parsed.method },
    });

    return { ok: true as const };
  });
}
