import { NextResponse, type NextRequest } from 'next/server';
import { AvailabilityQuerySchema } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { prisma } from '@/lib/db';
import { computeAvailability } from '@/lib/availability/engine';
import { errs, toResponseBody } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await rateLimit({ name: 'availability', identifier: ip, count: 30, window: '1 m' });
    if (!rl.ok) throw errs.rateLimited();

    const body = await req.json();
    const input = AvailabilityQuerySchema.parse(body);

    const business = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: { id: true, timezone: true, status: true },
    });
    if (!business || business.status !== 'active') throw errs.notFound('Business');

    const slots = await withTenant(input.businessId, (tx) =>
      computeAvailability(tx, {
        businessId: input.businessId,
        zoneId: input.zoneId,
        date: input.date,
        packageId: input.packageId,
        vehicleTypeId: input.vehicleTypeId,
        addonIds: input.addonIds,
        timezone: business.timezone,
      }),
    );

    return NextResponse.json({
      ok: true,
      data: {
        slots: slots.map((s) => ({
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          resourceId: s.resourceId,
        })),
      },
    });
  } catch (err) {
    const body = toResponseBody(err);
    const status = (err as any)?.status ?? 500;
    return NextResponse.json(body, { status });
  }
}
