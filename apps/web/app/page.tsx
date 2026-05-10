import Link from 'next/link';

export default function MarketingHome() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Splash</h1>
      <p className="mt-3 text-lg text-neutral-600">
        Mobile car wash operating system. Bookings, deposits, routes, loyalty, photo evidence — from your phone.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/signup" className="btn-primary">
          Create your account
        </Link>
        <Link href="/pricing" className="btn-ghost">
          See pricing
        </Link>
      </div>
      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Feature title="Bookings by zone and day" desc="Clients pick a slot in an active zone. Deposits of $20 hold the spot." />
        <Feature title="Loyalty per vehicle" desc="Track each car. 5 services = 15% off. 10 services = 25% off. Fully configurable." />
        <Feature title="Photo evidence" desc="Before, during, after. Protect yourself from disputes, fuel your marketing." />
        <Feature title="One dashboard" desc="Today's route, calendar, customers, payments, loyalty. PWA — works offline." />
      </section>
    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600">{desc}</p>
    </div>
  );
}
