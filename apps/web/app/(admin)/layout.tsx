import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Sidebar } from './_components/Sidebar';
import './admin.css';

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
    <div className="admin-shell flex min-h-full flex-col lg:flex-row">
      <Sidebar
        businessName={business.name}
        loyaltyEnabled={Boolean(features.loyalty)}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
