import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { uuid } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { loyaltyEligibility } from '@/lib/loyalty/eligibility';
import { errs, toResponseBody } from '@/lib/errors';
import { prisma } from '@/lib/db';

const Schema = z.object({
  businessId: uuid,
  vehicleId: uuid,
  packageId: uuid,
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const input = Schema.parse(await req.json());
    const business = await prisma.business.findUnique({
      where: { id: input.businessId },
      select: { features: true },
    });
    if (!business) throw errs.notFound('Business');
    const features = business.features as Record<string, boolean>;
    if (!features.loyalty) {
      return NextResponse.json({
        ok: true,
        data: { program: null, currentVisits: 0, lifetimeRevenueCents: 0, nextTier: null, rewardAvailable: null },
      });
    }
    const elig = await withTenant(input.businessId, (tx) => loyaltyEligibility(tx, input));
    return NextResponse.json({ ok: true, data: elig });
  } catch (err) {
    const body = toResponseBody(err);
    const status = (err as any)?.status ?? 500;
    return NextResponse.json(body, { status });
  }
}
