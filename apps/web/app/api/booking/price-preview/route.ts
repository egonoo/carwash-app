import { NextResponse, type NextRequest } from 'next/server';
import { PricePreviewInputSchema } from '@splash/schemas';
import { withTenant } from '@/lib/rls';
import { computePricing } from '@/lib/pricing/engine';
import { prisma } from '@/lib/db';
import { errs, toResponseBody } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await rateLimit({ name: 'price-preview', identifier: ip, count: 60, window: '1 m' });
    if (!rl.ok) throw errs.rateLimited();

    const body = await req.json();
    const input = PricePreviewInputSchema.parse(body);

    // Si envían email, intentar resolver vehicleId por match. No falla si no.
    let vehicleId = input.vehicleId ?? null;
    if (!vehicleId && input.customerEmail) {
      const customer = await prisma.customer.findFirst({
        where: { businessId: input.businessId, email: input.customerEmail },
        select: { id: true, vehicles: { where: { archivedAt: null }, take: 5, select: { id: true } } },
      });
      // si tiene un solo vehículo, lo usamos para preview (UI lo confirmará)
      if (customer?.vehicles.length === 1) vehicleId = customer.vehicles[0]!.id;
    }

    const breakdown = await withTenant(input.businessId, (tx) =>
      computePricing(tx, {
        businessId: input.businessId,
        packageId: input.packageId,
        vehicleTypeId: input.vehicleTypeId,
        vehicleId,
        zoneId: input.zoneId ?? null,
        addons: input.addons,
        promoCode: input.promoCode ?? null,
      }),
    );

    return NextResponse.json({ ok: true, data: breakdown });
  } catch (err) {
    const body = toResponseBody(err);
    const status = (err as any)?.status ?? 500;
    return NextResponse.json(body, { status });
  }
}
