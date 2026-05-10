import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const business = await prisma.business.findUnique({
    where: { id: session.activeBusinessId },
    select: { name: true, slug: true, features: true },
  });
  if (!business) redirect('/login');

  const features = business.features as Record<string, boolean>;

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <aside className="w-full border-b bg-neutral-50 lg:w-64 lg:border-b-0 lg:border-r">
        <div className="p-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {business.name}
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 px-2 pb-4 lg:block lg:space-y-1 lg:px-4">
          <NavLink href="/today">Today</NavLink>
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/schedule">Schedule</NavLink>
          <NavLink href="/appointments">Appointments</NavLink>
          <NavLink href="/bookings">Bookings</NavLink>
          <NavLink href="/customers">Customers</NavLink>
          <NavLink href="/packages">Packages</NavLink>
          <NavLink href="/addons">Add-ons</NavLink>
          <NavLink href="/zones">Zones</NavLink>
          <NavLink href="/availability">Availability</NavLink>
          <NavLink href="/payments">Payments</NavLink>
          {features.loyalty && <NavLink href="/loyalty">Loyalty</NavLink>}
          <NavLink href="/settings">Settings</NavLink>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href as any}
      className="block rounded-md px-3 py-2 text-sm text-neutral-700 hover:bg-white hover:text-neutral-900"
    >
      {children}
    </Link>
  );
}
