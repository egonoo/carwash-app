import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Compass, Hammer, HeartHandshake, Sparkles } from 'lucide-react';
import { GlassCard, PageHero, PageSection } from '../_components/PageHero';

export const metadata: Metadata = {
  title: 'About — Splash',
  description:
    'Splash builds the operating system for mobile car wash and detailing teams. Learn what we believe and where we are headed.',
};

const VALUES = [
  {
    icon: Compass,
    title: 'Built for the field',
    desc: 'Every screen is designed for crews working out of a truck — one hand on a phone, the other holding a foam cannon.',
  },
  {
    icon: Hammer,
    title: 'Operator-first software',
    desc: 'We optimize for the owner-operator who is dispatcher, technician, and accountant. The tool has to disappear into the day.',
  },
  {
    icon: HeartHandshake,
    title: 'Your money, your customers',
    desc: 'Bring your own Stripe. Own your customer data. Splash is infrastructure — not a marketplace skimming your margins.',
  },
  {
    icon: Sparkles,
    title: 'Premium by default',
    desc: 'Detailing is a craft. Your software should feel as polished as your finished work — for you and for your customers.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Splash"
        title={
          <>
            Software for the people{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              actually doing the work.
            </span>
          </>
        }
        description="Splash is the operating system for mobile car wash and detailing teams — built by people who shadowed real crews, ran real routes, and watched real money slip through the cracks of off-the-shelf tools."
      />

      <PageSection>
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <h2 className="text-2xl font-semibold tracking-tight">Our story</h2>
            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-white/70">
              <p>
                Splash started after months riding along with mobile detailing
                crews — watching them juggle a calendar app, a payments app, a
                notes app, a route planner, and a separate camera roll for
                before-and-after photos. Bookings fell through. Deposits got
                missed. Photos got lost. The software was fighting the work.
              </p>
              <p>
                We set out to build a single product that respects how the job
                actually runs: zone-aware bookings, deposits handled through
                the operator&apos;s own Stripe account, photo evidence captured
                in seconds, and a phone-first admin that lives where the team
                lives — in the truck.
              </p>
              <p>
                Today, Splash is in private beta with a hand-picked group of
                detailing teams across North America. Every feature ships
                because an operator asked for it.
              </p>
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="text-2xl font-semibold tracking-tight">What we believe</h2>
            <ul className="mt-4 space-y-4 text-[15px] leading-relaxed text-white/70">
              <li>
                <span className="font-medium text-white">Operators win, or we don&apos;t.</span>{' '}
                Splash takes no cut of bookings or payouts. You keep your
                customer relationships and your margins.
              </li>
              <li>
                <span className="font-medium text-white">The phone is the dashboard.</span>{' '}
                We design for thumbs in gloves, not pixel-peeping in a corner office.
              </li>
              <li>
                <span className="font-medium text-white">Boring software, exciting outcomes.</span>{' '}
                The product should be invisible. The wins — more bookings, fewer
                no-shows, faster payouts — should be loud.
              </li>
              <li>
                <span className="font-medium text-white">Trust is non-negotiable.</span>{' '}
                Customer photos, payments, and personal data are handled with
                the seriousness they deserve.
              </li>
            </ul>
          </GlassCard>
        </div>
      </PageSection>

      <PageSection className="!pt-0">
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
            Principles
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            How we build, in four lines
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6"
            >
              <div className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/90">
                <v.icon size={16} />
              </div>
              <h3 className="mt-5 text-[15px] font-semibold tracking-tight">
                {v.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                {v.desc}
              </p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection className="!pt-0 !pb-32">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0E1424] via-[#0B0E14] to-[#0B0E14] p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Want to talk shop?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/65">
            We love hearing from operators. Drop us a note and we&apos;ll get back
            within one business day.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/contact"
              className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
            >
              Get in touch
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/customers-stories"
              className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.08]"
            >
              See who&apos;s using Splash
            </Link>
          </div>
        </div>
      </PageSection>
    </>
  );
}
