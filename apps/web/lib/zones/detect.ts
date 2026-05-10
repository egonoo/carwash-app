import type { Prisma } from '@splash/db';

export type DetectedZone = {
  id: string;
  name: string;
  extraFeeCents: number;
  travelTimeMinutes: number | null;
  matchedBy: 'zip' | 'fallback';
};

export function normalizeZip(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Resuelve la zona aplicable a un ZIP. Lectura pura — no escribe.
 *  1. Match exacto contra Zone.zipCodes[] (zonas activas, no archivadas).
 *  2. Fallback: zona llamada "Local Area" del mismo business.
 *  3. null si nada aplica — el caller decide si bloquea o no.
 */
export async function detectZoneByZip(
  tx: Prisma.TransactionClient,
  businessId: string,
  rawZip: string,
): Promise<DetectedZone | null> {
  const zip = normalizeZip(rawZip);
  if (!zip) return null;

  const byZip = await tx.zone.findFirst({
    where: {
      businessId,
      isActive: true,
      archivedAt: null,
      zipCodes: { has: zip },
    },
    select: { id: true, name: true, extraFeeCents: true, travelTimeMinutes: true },
    orderBy: { displayOrder: 'asc' },
  });
  if (byZip) {
    return { ...byZip, matchedBy: 'zip' };
  }

  const fallback = await tx.zone.findFirst({
    where: {
      businessId,
      isActive: true,
      archivedAt: null,
      name: { equals: 'Local Area', mode: 'insensitive' },
    },
    select: { id: true, name: true, extraFeeCents: true, travelTimeMinutes: true },
  });
  if (fallback) {
    return { ...fallback, matchedBy: 'fallback' };
  }

  return null;
}
