import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/rls';
import { BookingWizard } from '@/components/booking/BookingWizard';

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await prisma.business.findFirst({
    where: { slug, deletedAt: null, status: 'active' },
    select: {
      id: true,
      name: true,
      timezone: true,
      currency: true,
      features: true,
      evidenceMinPhotos: true,
    },
  });
  if (!business) notFound();

  const features = business.features as Record<string, boolean>;

  const data = await withTenant(business.id, async (tx) => {
    const [zones, vehicleTypes, packages, addons] = await Promise.all([
      tx.zone.findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, name: true, color: true, description: true },
      }),
      tx.vehicleType.findMany({
        where: { archivedAt: null },
        orderBy: { displayOrder: 'asc' },
        select: { id: true, name: true, examples: true },
      }),
      tx.package.findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: { displayOrder: 'asc' },
        include: { prices: { select: { vehicleTypeId: true, priceCents: true, durationMinutes: true, isAvailable: true } } },
      }),
      tx.addon.findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);
    return { zones, vehicleTypes, packages, addons };
  });

  return (
    <BookingWizard
      business={{
        id: business.id,
        name: business.name,
        slug,
        timezone: business.timezone,
        currency: business.currency,
        features,
        evidenceMinPhotos: business.evidenceMinPhotos,
      }}
      catalog={data}
    />
  );
}
