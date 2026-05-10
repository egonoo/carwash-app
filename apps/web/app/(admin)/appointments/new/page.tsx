import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { CreateAppointmentForm } from './CreateAppointmentForm';

export default async function NewAppointmentPage() {
  const session = await requireSession();

  const { vehicles, vehicleTypes, zones, packages, addons } = await withTenant(
    session.activeBusinessId,
    async (tx) => {
      const [vehicles, vehicleTypes, zones, packages, addons] = await Promise.all([
        tx.vehicle.findMany({
          where: { archivedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: {
            id: true,
            internalCode: true,
            make: true,
            model: true,
            year: true,
            plate: true,
            vehicleType: { select: { id: true, name: true } },
            customer: {
              select: { firstName: true, lastName: true, email: true, phoneE164: true },
            },
          },
        }),
        tx.vehicleType.findMany({
          where: { archivedAt: null },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true },
        }),
        tx.zone.findMany({
          where: { isActive: true, archivedAt: null },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true },
        }),
        tx.package.findMany({
          where: { isActive: true, archivedAt: null },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true },
        }),
        tx.addon.findMany({
          where: { isActive: true, archivedAt: null },
          orderBy: { displayOrder: 'asc' },
          select: { id: true, name: true },
        }),
      ]);
      return { vehicles, vehicleTypes, zones, packages, addons };
    },
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Create Appointment</h1>
        <Link
          href={'/appointments' as any}
          className="mt-1 inline-block text-sm text-blue-600 hover:underline"
        >
          ← Back to appointments
        </Link>
      </div>

      <CreateAppointmentForm
        vehicles={vehicles}
        vehicleTypes={vehicleTypes}
        zones={zones}
        packages={packages}
        addons={addons}
      />
    </div>
  );
}
