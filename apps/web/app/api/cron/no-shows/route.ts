import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withoutTenant } from '@/lib/rls';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Marca como no_show las citas que debieron empezar hace 30+ min y siguen en estados
 * pre-service (confirmed, on_the_way, arrived). Idempotente.
 * Proteger en prod con verify de Upstash signature.
 */
export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const cutoff = new Date(Date.now() - 30 * 60_000);

  const candidates = await prisma.appointment.findMany({
    where: {
      status: { in: ['confirmed', 'on_the_way', 'arrived'] },
      startsAt: { lte: cutoff },
    },
    select: { id: true, businessId: true },
    take: 500,
  });

  let processed = 0;
  for (const c of candidates) {
    await withoutTenant(async (tx) => {
      const fresh = await tx.appointment.findUnique({
        where: { id: c.id },
        select: { status: true },
      });
      if (!fresh || !['confirmed', 'on_the_way', 'arrived'].includes(fresh.status)) return;

      await tx.appointment.update({
        where: { id: c.id },
        data: { status: 'no_show', noShowAt: new Date(), noShowReason: 'auto: 30min past start' },
      });
      await audit(tx, {
        businessId: c.businessId,
        actorType: 'system',
        action: 'state_change',
        entityType: 'appointment',
        entityId: c.id,
        diff: { to: 'no_show', reason: 'auto cron' },
      });
      processed++;
    });
  }

  return NextResponse.json({ ok: true, data: { processed } });
}

function verifyCronAuth(req: NextRequest): boolean {
  const signature = req.headers.get('upstash-signature');
  // En local/dev se permite con header de debug.
  if (process.env.NODE_ENV !== 'production') return true;
  return !!signature;
}
