import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { uuid } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { prisma } from '@/lib/db';
import { checkPointAvailability } from '@/lib/availability/point';
import { errs, toResponseBody } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const InputSchema = z.object({
  businessId: uuid,
  zoneId: uuid.optional(),
  date: z.string().regex(YMD_RE, 'Invalid date'),
  time: z.string().regex(HHMM_RE, 'Invalid time'),
});

// =============================================================================
// POST /api/booking/availability/point
// Lightweight availability check used by the booking wizard's Step 2 to
// validate the chosen date/time against global business rules (working
// hours, closed days, breaks, manual blocked time) before the customer has
// chosen a package. Duration-aware checks happen later via the full engine.
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await rateLimit({
      name: 'availability-point',
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
      checkPointAvailability(tx, {
        businessId: input.businessId,
        zoneId: input.zoneId,
        date: input.date,
        time: input.time,
        timezone: business.timezone,
      }),
    );

    return NextResponse.json({
      ok: true,
      data: {
        available: result.available,
        reason: result.reason ?? null,
        isoStartsAt: result.isoStartsAt,
      },
    });
  } catch (err) {
    const body = toResponseBody(err);
    const status = (err as { status?: number })?.status ?? 500;
    return NextResponse.json(body, { status });
  }
}
