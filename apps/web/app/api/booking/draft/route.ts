import { NextResponse, type NextRequest } from 'next/server';
import { createBookingDraft } from '@/actions/booking';
import { BookingDraftInputSchema } from '@splash/schemas';
import { errs, toResponseBody } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
    const rl = await rateLimit({ name: 'booking-draft', identifier: ip, count: 10, window: '1 m' });
    if (!rl.ok) throw errs.rateLimited();

    const body = await req.json();
    const parsed = BookingDraftInputSchema.safeParse(body);
    if (!parsed.success) {
      throw errs.validation(parsed.error.flatten());
    }
    const result = await createBookingDraft(parsed.data);

    return NextResponse.json({
      ok: true,
      data: {
        appointmentId: result.appointmentId,
        depositMethod: result.depositMethod,
        clientSecret: result.clientSecret,
        paymentIntentId: result.paymentIntentId,
        depositAmountCents: result.depositAmountCents,
        totalCents: result.totalCents,
        balanceDueOnServiceCents: result.balanceDueOnServiceCents,
      },
    });
  } catch (err) {
    const body = toResponseBody(err);
    const status = (err as any)?.status ?? 500;
    return NextResponse.json(body, { status });
  }
}
