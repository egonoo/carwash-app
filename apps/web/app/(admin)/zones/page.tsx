import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { prisma } from '@/lib/db';
import { ZonesManager, type ZoneRow } from './ZonesManager';

export default async function ZonesPage() {
  const session = await requireSession();

  const [zones, business] = await Promise.all([
    withTenant(session.activeBusinessId, (tx) =>
      tx.zone.findMany({
        where: { archivedAt: null },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          description: true,
          zipCodes: true,
          isActive: true,
          travelTimeMinutes: true,
          extraFeeCents: true,
          maxConcurrentJobs: true,
          displayOrder: true,
          _count: { select: { appointments: true } },
        },
      }),
    ),
    prisma.business.findUnique({
      where: { id: session.activeBusinessId },
      select: { defaultTravelTimeMin: true },
    }),
  ]);

  const rows: ZoneRow[] = zones.map((z) => ({
    id: z.id,
    name: z.name,
    slug: z.slug,
    color: z.color,
    description: z.description,
    zipCodes: z.zipCodes,
    isActive: z.isActive,
    travelTimeMinutes: z.travelTimeMinutes,
    extraFeeCents: z.extraFeeCents,
    maxConcurrentJobs: z.maxConcurrentJobs ?? 1,
    displayOrder: z.displayOrder,
    appointmentCount: z._count.appointments,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Zones</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Service areas, travel times, and per-zone fees.
      </p>

      <div className="mt-6">
        <ZonesManager
          zones={rows}
          defaultTravelTimeMin={business?.defaultTravelTimeMin ?? 20}
        />
      </div>
    </div>
  );
}
