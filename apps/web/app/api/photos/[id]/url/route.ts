import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant, withoutTenant } from '@/lib/rls';
import { getSession, verifyManageToken } from '@/lib/auth';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { presignRead } from '@/lib/storage/r2';
import { errs, toResponseBody } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    const manageToken = req.nextUrl.searchParams.get('token');
    const tenant = await resolveTenantFromRequest();

    const businessId = session?.activeBusinessId ?? tenant?.id;
    if (!businessId && !manageToken) throw errs.unauthorized();

    const photo = session
      ? await withTenant(session.activeBusinessId, async (tx) =>
          tx.evidencePhoto.findUnique({
            where: { id },
            select: {
              id: true,
              businessId: true,
              appointmentId: true,
              storageBucket: true,
              storageKey: true,
              softDeletedAt: true,
              scanStatus: true,
            },
          }),
        )
      : await withoutTenant(async (tx) =>
          tx.evidencePhoto.findUnique({
            where: { id },
            select: {
              id: true,
              businessId: true,
              appointmentId: true,
              storageBucket: true,
              storageKey: true,
              softDeletedAt: true,
              scanStatus: true,
            },
          }),
        );

    if (!photo || photo.softDeletedAt) throw errs.notFound('Photo');

    if (session) {
      if (photo.businessId !== session.activeBusinessId) throw errs.forbidden();
    } else if (manageToken) {
      const v = await verifyManageToken(manageToken);
      if (!v || v.appointmentId !== photo.appointmentId) throw errs.forbidden();
    } else {
      throw errs.unauthorized();
    }

    if (photo.scanStatus === 'infected') throw errs.forbidden('Photo flagged');

    const url = await presignRead({
      bucket: photo.storageBucket,
      key: photo.storageKey,
      expiresIn: 300,
    });

    if (!url || typeof url !== 'string') {
      throw new Error('Unable to generate signed photo URL');
    }

    console.info(
      `[photos/url] id=${id} bucket=${photo.storageBucket} key=${photo.storageKey} url=${url}`,
    );

    return NextResponse.json({ url });
  } catch (err) {
    const body = toResponseBody(err);
    const status = (err as any)?.status ?? 500;
    return NextResponse.json(body, { status });
  }
}
