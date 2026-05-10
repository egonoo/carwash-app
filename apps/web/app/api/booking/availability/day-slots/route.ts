import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { uuid } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { prisma } from '@/lib/db';
import { enumerateDaySlots } from '@/lib/availability/day-slots';
import { errs, toResponseBody } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const InputSchema = z.object({
  businessId: uuid,
  zoneId: uuid.optional(),
  date: z.string().regex(YMD_RE, 'Invalid date'),
});

// =============================================================================
// POST /api/booking/availability/day-slots
// Returns the 30-minute slot grid for a given date, with each slot marked
// available/unavailable per the global business rules. Used by the booking
// wizard's Step 2 to render a visual slot picker.
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await rateLimit({
      name: 'availability-day-slots',
      identifier: ip,
      count: 60,
      window: '1 m',
    });
    if (!rl.ok) throw errs.rateLimited();

    const input = InputSchema.parse(await req.json());

    const business = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: { id: true, timezone: true, status: true },
    });
    if (!business || business.status !== 'active') throw errs.notFound('Business');

    const result = await withTenant(input.businessId, (tx) =>
      enumerateDaySlots(tx, {
        businessId: input.businessId,
        zoneId: input.zoneId,
        date: input.date,
        timezone: business.timezone,
      }),
    );

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const body = toResponseBody(err);
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json(body, { status });
  }
}
