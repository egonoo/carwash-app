import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { uuid } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { detectZoneByZip } from '@/lib/zones/detect';
import { errs, toResponseBody } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const InputSchema = z.object({
  businessId: uuid,
  zip: z.string().trim().min(1).max(12),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await rateLimit({ name: 'detect-zone', identifier: ip, count: 60, window: '1 m' });
    if (!rl.ok) throw errs.rateLimited();

    const body = await req.json();
    const input = InputSchema.parse(body);

    const zone = await withTenant(input.businessId, (tx) =>
      detectZoneByZip(tx, input.businessId, input.zip),
    );

    return NextResponse.json({ ok: true, data: { zone } });
  } catch (err) {
    const body = toResponseBody(err);
    const status = (err as any)?.status ?? 500;
    return NextResponse.json(body, { status });
  }
}
