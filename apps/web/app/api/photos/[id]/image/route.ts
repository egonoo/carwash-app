import { NextResponse, type NextRequest } from 'next/server';
import { Readable } from 'node:stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client } from '@/lib/storage/r2';
import { withTenant, withoutTenant } from '@/lib/rls';
import { getSession, verifyManageToken } from '@/lib/auth';
import { resolveTenantFromRequest } from '@/lib/tenant';
import { errs, toResponseBody } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeBody(body: unknown): ReadableStream<Uint8Array> | ArrayBuffer | Uint8Array | string {
  if (body instanceof Readable) {
    return Readable.toWeb(body) as ReadableStream<Uint8Array>;
  }

  if (typeof body === 'string' || body instanceof Uint8Array || body instanceof ArrayBuffer) {
    return body;
  }

  if (body && typeof (body as any).getReader === 'function') {
    return body as ReadableStream<Uint8Array>;
  }

  return body as ReadableStream<Uint8Array>;
}

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
              mimeType: true,
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
              mimeType: true,
              softDeletedAt: true,
              scanStatus: true,
            },
          }),
        );

    if (!photo || photo.softDeletedAt) throw errs.notFound('Photo');

    if (session) {
      if (photo.businessId !== session.activeBusinessId) throw errs.forbidden();
    } else if (manageToken) {
      const verified = await verifyManageToken(manageToken);
      if (!verified || verified.appointmentId !== photo.appointmentId) throw errs.forbidden();
    } else {
      throw errs.unauthorized();
    }

    if (photo.scanStatus === 'infected') throw errs.forbidden('Photo flagged');

    console.info('[photos/image] fetching photo from R2', {
      photoId: photo.id,
      storageBucket: photo.storageBucket,
      storageKey: photo.storageKey,
      endpointEnv: 'R2_ENDPOINT',
      regionEnv: 'R2_REGION',
      bucketEnv: 'storageBucket',
    });

    const command = new GetObjectCommand({
      Bucket: photo.storageBucket,
      Key: photo.storageKey,
    });

    let result;
    try {
      result = await getR2Client().send(command);
    } catch (r2Error) {
      const errorName = (r2Error as any)?.name ?? 'UnknownError';
      const errorMessage = (r2Error as any)?.message ?? 'No message';
      const errorStack = (r2Error as any)?.stack ?? 'No stack';
      const statusCode = (r2Error as any)?.$metadata?.httpStatusCode;

      console.error('[photos/image] R2 fetch failed', {
        photoId: photo.id,
        storageBucket: photo.storageBucket,
        storageKey: photo.storageKey,
        endpointEnv: 'R2_ENDPOINT',
        regionEnv: 'R2_REGION',
        errorName,
        errorMessage,
        errorStack,
        statusCode,
      });

      if (errorName === 'NoSuchKey' || statusCode === 404) {
        throw errs.notFound('Photo object');
      }

      throw r2Error;
    }
    if (!result.Body) {
      throw new Error('Photo data not found in R2');
    }

    const contentType = result.ContentType ?? photo.mimeType ?? 'application/octet-stream';
    const body = normalizeBody(result.Body);

    return new NextResponse(body as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (err) {
    const status = (err as any)?.status ?? 500;
    const errorName = (err as Error)?.name ?? 'UnknownError';
    const errorMessage = (err as Error)?.message ?? 'Unknown error';
    const errorStack = (err as Error)?.stack ?? undefined;

    console.error('[photos/image] request failed', {
      photoId: (err as any)?.photoId ?? null,
      storageBucket: (err as any)?.storageBucket ?? null,
      storageKey: (err as any)?.storageKey ?? null,
      status,
      errorName,
      errorMessage,
      errorStack,
    });

    if (status >= 500) {
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          status,
          name: errorName,
          message: errorMessage,
          stack: process.env.NODE_ENV === 'production' ? undefined : errorStack,
          debug: {
            endpointEnv: 'R2_ENDPOINT',
            regionEnv: 'R2_REGION',
            endpointValue: process.env.R2_ENDPOINT ?? null,
            regionValue: process.env.R2_REGION ?? 'auto',
          },
        },
        { status },
      );
    }

    const body = toResponseBody(err);
    return NextResponse.json(body, { status });
  }
}
