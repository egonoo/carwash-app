import type { Metadata } from 'next';
import { Nav } from './_components/Nav';
import { Footer } from './_components/Footer';

export const metadata: Metadata = {
  title: 'Splash — The mobile car wash operating system',
  description:
    'Bookings, deposits, routes, loyalty, and photo evidence. Splash is the all-in-one platform for mobile detailing teams.',
  openGraph: {
    title: 'Splash — The mobile car wash operating system',
    description:
      'The all-in-one platform for mobile detailing teams. Bookings, deposits, routes, loyalty, and photo evidence — from your phone.',
    type: 'website',
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#06070A] text-white">
      {/* Ambient background — subtle radial + grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1200px 600px at 50% -10%, rgba(10,132,255,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(168,85,247,0.10), transparent 60%), #06070A',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <Nav />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
