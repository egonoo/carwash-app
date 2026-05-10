import { NextResponse, type NextRequest } from 'next/server';
import { PhotoPresignSchema } from '@splash/schemas';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/rls';
import { getSession } from '@/lib/auth';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { presignUpload, evidenceKey, mimeToExt, EVIDENCE_BUCKET } from '@/lib/storage/r2';
import { errs, toResponseBody } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
    const rl = await rateLimit({ name: 'photos-presign', identifier: ip, count: 30, window: '1 m' });
    if (!rl.ok) throw errs.rateLimited();

    const body = await req.json();
    const input = PhotoPresignSchema.parse(body);

    const session = await getSession();
    const tenant = await resolveTenantFromRequest();

    // Para admin: usar session.activeBusinessId. Para cliente: usar tenant (del host).
    const businessId = session?.activeBusinessId ?? tenant?.id;
    if (!businessId) throw errs.unauthorized();

    // Verificar feature flag
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { features: true, evidenceMaxPhotosCust: true, evidenceMaxPhotosAdmin: true },
    });
    const features = business.features as Record<string, boolean>;
    if (!features.photos) throw errs.featureDisabled('photos');

    return await withTenant(businessId, async (tx) => {
      // Verificar appointment pertenece al tenant
      const appt = await tx.appointment.findUnique({
        where: { id: input.appointmentId },
        select: { id: true, customerId: true, vehicleId: true, status: true },
      });
      if (!appt) throw errs.notFound('Appointment');

      // Bounds por fase
      const existingCount = await tx.evidencePhoto.count({
        where: { appointmentId: appt.id, phase: input.phase, softDeletedAt: null },
      });
      const isCustomerPhase = input.phase === 'pre_service_customer';
      const max = isCustomerPhase ? business.evidenceMaxPhotosCust : business.evidenceMaxPhotosAdmin;
      if (existingCount >= max) {
        throw errs.validation({ message: `Max photos reached for phase (${max})` });
      }

      // Customer phase requires no session; admin phases require session
      if (!isCustomerPhase && !session) {
        throw errs.unauthorized();
      }

      const photoId = randomUUID();
      const ext = mimeToExt(input.mimeType);
      const key = evidenceKey({
        businessId,
        appointmentId: appt.id,
        phase: input.phase,
        photoId,
        ext,
      });

      // Crear registro pending (sin confirmar upload todavía)
      await tx.evidencePhoto.create({
        data: {
          id: photoId,
          businessId,
          appointmentId: appt.id,
          customerId: appt.customerId,
          vehicleId: appt.vehicleId,
          phase: input.phase,
          slotTag: input.slotTag ?? null,
          note: input.note ?? null,
          storageBucket: EVIDENCE_BUCKET(),
          storageKey: key,
          mimeType: input.mimeType,
          bytes: input.bytes,
          scanStatus: 'pending',
          uploadedByUserId: session?.userId ?? null,
          uploadedByCustomerId: session?.userId ? null : appt.customerId,
        },
      });

      const { url, headers } = await presignUpload({
        bucket: EVIDENCE_BUCKET(),
        key,
        mimeType: input.mimeType,
        contentLength: input.bytes,
        expiresIn: 300,
      });

      return NextResponse.json({
        ok: true,
        data: {
          photoId,
          uploadUrl: url,
          uploadHeaders: headers,
          expiresIn: 300,
        },
      });
    });
  } catch (err) {
    const body = toResponseBody(err);
    const status = (err as any)?.status ?? 500;
    return NextResponse.json(body, { status });
  }
}
