import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarRange,
  CreditCard,
  HelpCircle,
  KeyRound,
  Smartphone,
  Star,
  Truck,
  Users,
} from 'lucide-react';
import { GlassCard, PageHero, PageSection } from '../_components/PageHero';

export const metadata: Metadata = {
  title: 'Help center — Splash',
  description:
    'Answers to common questions about bookings, deposits, payouts, photos, loyalty, and your account.',
};

const CATEGORIES = [
  {
    icon: KeyRound,
    title: 'Account & billing',
    desc: 'Plans, invoices, switching tiers, cancellation, and team members.',
    articles: [
      'How do I change plans?',
      'Where do I find my invoices?',
      'How do I add a teammate to my business?',
    ],
  },
  {
    icon: CreditCard,
    title: 'Payments & Stripe Connect',
    desc: 'Connecting Stripe, deposits, capturing balances, refunds, and payouts.',
    articles: [
      'My Stripe account is connected — when do payouts arrive?',
      'How do I refund a deposit?',
      'Can I take a card on the day instead of online?',
    ],
  },
  {
    icon: CalendarRange,
    title: 'Bookings & availability',
    desc: 'Working hours, breaks, blocks, zone-aware availability, and overrides.',
    articles: [
      'Why isn\'t a slot showing for a customer?',
      'How do I block a day off?',
      'Can I move an appointment to a different zone?',
    ],
  },
  {
    icon: Truck,
    title: 'Routes & zones',
    desc: 'Defining service areas, travel time, per-zone fees, and route building.',
    articles: [
      'How do I draw a service zone?',
      'How are travel times calculated?',
      'Can I charge a different deposit per zone?',
    ],
  },
  {
    icon: Smartphone,
    title: 'Mobile workflow',
    desc: 'Today screen, on-the-way, photo capture, and final payment in the field.',
    articles: [
      'How do I capture before/after photos?',
      'How do I mark a job complete and take final payment?',
      'What does the customer see when I tap on-the-way?',
    ],
  },
  {
    icon: Star,
    title: 'Loyalty & retention',
    desc: 'Configuring per-vehicle loyalty tiers and applying automatic discounts.',
    articles: [
      'How do I set up a loyalty tier?',
      'Why is loyalty tracked per vehicle?',
      'Can I exclude certain services from loyalty?',
    ],
  },
  {
    icon: Users,
    title: 'Customers & vehicles',
    desc: 'Managing customer records, multiple vehicles per customer, and notes.',
    articles: [
      'How do I merge duplicate customers?',
      'Where do I add a note about a vehicle?',
      'Can a customer manage their own appointments?',
    ],
  },
  {
    icon: HelpCircle,
    title: 'Troubleshooting',
    desc: 'Login issues, email/SMS delivery, photos not uploading, and other gotchas.',
    articles: [
      'I\'m not receiving login emails',
      'A customer says the booking page won\'t load',
      'Photos are stuck uploading',
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <PageHero
        eyebrow="Help center"
        title={
          <>
            Find an answer or{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              talk to a human.
            </span>
          </>
        }
        description="Common questions, organized by what you're trying to do. If you can't find what you need, we're one email away."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/contact"
            className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
          >
            Contact support
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.08]"
          >
            Browse the docs
          </Link>
        </div>
      </PageHero>

      <PageSection>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <GlassCard key={c.title}>
              <div className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/90">
                <c.icon size={16} />
              </div>
              <h3 className="mt-5 text-[15px] font-semibold tracking-tight">
                {c.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                {c.desc}
              </p>
              <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
                {c.articles.map((a) => (
                  <li
                    key={a}
                    className="flex items-start gap-2 text-[13px] text-white/70"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#5EB1FF]" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </PageSection>

      <PageSection className="!pt-0 !pb-32">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0E1424] via-[#0B0E14] to-[#0B0E14] p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Still stuck?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/65">
            Send us a note with your business name and the screen you&apos;re
            on. We reply within one business day, often much sooner.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/contact"
              className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
            >
              Email support
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </div>
      </PageSection>
    </>
  );
}
