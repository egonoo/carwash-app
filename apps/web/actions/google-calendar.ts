'use server';

import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  buildGoogleAuthUrl,
  revokeGoogleToken,
  signOauthState,
} from '@/lib/google-calendar';
import { withTenant } from '@/lib/rls';

export async function startGoogleCalendarConnect(): Promise<{ url: string }> {
  const session = await requireRole(['owner', 'admin']);
  const state = await signOauthState({
    businessId: session.activeBusinessId,
    userId: session.userId,
  });
  return { url: buildGoogleAuthUrl(state) };
}

export async function disconnectGoogleCalendar(): Promise<{ ok: true }> {
  const session = await requireRole(['owner', 'admin']);

  const business = await prisma.business.findUnique({
    where: { id: session.activeBusinessId },
    select: { googleRefreshTokenEnc: true },
  });
  if (business?.googleRefreshTokenEnc) {
    await revokeGoogleToken(business.googleRefreshTokenEnc);
  }

  await withTenant(session.activeBusinessId, async (tx) => {
    await tx.business.update({
      where: { id: session.activeBusinessId },
      data: {
        googleCalendarId: null,
        googleCalendarEmail: null,
        googleCalendarConnectedAt: null,
        googleRefreshTokenEnc: null,
      },
    });
    await audit(tx, {
      businessId: session.activeBusinessId,
      actorType: 'user',
      actorUserId: session.userId,
      action: 'update',
      entityType: 'business',
      entityId: session.activeBusinessId,
      diff: { googleCalendarConnected: false },
      metadata: { event: 'google_calendar.disconnected' },
    });
  });

  revalidatePath('/settings');
  return { ok: true as const };
}
