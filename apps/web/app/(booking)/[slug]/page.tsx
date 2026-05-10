import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/rls';

export default async function BusinessLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await prisma.business.findFirst({
    where: { slug, deletedAt: null, status: 'active' },
    select: {
      id: true,
      name: true,
      logoStorageKey: true,
      brandColor: true,
    },
  });
  if (!business) notFound();

  const { packages, addons } = await withTenant(business.id, async (tx) => {
    const [packages, addons] = await Promise.all([
      tx.package.findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: { displayOrder: 'asc' },
        include: { prices: { include: { vehicleType: true } } },
      }),
      tx.addon.findMany({
        where: { isActive: true, archivedAt: null },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);
    return { packages, addons };
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold">{business.name}</h1>
        <p className="mt-2 text-neutral-600">Mobile car wash &amp; detailing. Book in 60 seconds.</p>
        <Link href={`/${slug}/book` as any} className="btn-primary mt-6 inline-flex">
          Book now
        </Link>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Packages</h2>
        <div className="mt-4 space-y-3">
          {packages.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                <span className="text-sm text-neutral-500">
                  from ${Math.min(...p.prices.map((pr) => pr.priceCents)) / 100}
                </span>
              </div>
              {p.description && (
                <p className="mt-1 text-sm text-neutral-600">{p.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {p.prices.map((pr) => (
                  <span key={pr.vehicleTypeId} className="rounded bg-neutral-100 px-2 py-1">
                    {pr.vehicleType.name}: ${(pr.priceCents / 100).toFixed(0)} · {pr.durationMinutes}m
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Add-ons</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {addons.map((a) => (
            <li key={a.id} className="rounded bg-neutral-50 p-3">
              <div className="font-medium">{a.name}</div>
              <div className="text-neutral-500">
                {a.pricingMode === 'quote_on_site'
                  ? 'Quote on site'
                  : a.pricingMode === 'starting_at'
                    ? `from $${(a.basePriceCents / 100).toFixed(0)}`
                    : a.pricingMode === 'per_unit'
                      ? `$${(a.basePriceCents / 100).toFixed(0)} each`
                      : `$${(a.basePriceCents / 100).toFixed(0)}`}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
