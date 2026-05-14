import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarRange,
  Camera,
  CreditCard,
  LayoutDashboard,
  PlugZap,
  Rocket,
  ShieldCheck,
  Smartphone,
  Star,
} from 'lucide-react';
import { PageHero, PageSection } from '../_components/PageHero';

export const metadata: Metadata = {
  title: 'Docs — Splash',
  description:
    'Setup, onboarding, booking flow, Stripe Connect, admin dashboard, customer booking, and integrations — everything you need to run Splash.',
};

const SECTIONS = [
  {
    eyebrow: 'Get started',
    items: [
      {
        icon: Rocket,
        title: 'Quickstart',
        href: '/docs#quickstart',
        desc: 'Stand up your booking page, take your first deposit, and run a route in under 30 minutes.',
      },
      {
        icon: BookOpen,
        title: 'Onboarding checklist',
        href: '/docs#onboarding',
        desc: 'A guided walkthrough: services, zones, working hours, deposits, and your first booking.',
      },
    ],
  },
  {
    eyebrow: 'Operating Splash',
    items: [
      {
        icon: LayoutDashboard,
        title: 'Admin dashboard',
        href: '/docs#admin',
        desc: 'Where the day starts. Schedule, today\'s route, payments, customers, vehicles, and settings.',
      },
      {
        icon: CalendarRange,
        title: 'Bookings & availability',
        href: '/docs#bookings',
        desc: 'Slot rules, working hours, manual blocks, zone-aware availability, and overrides.',
      },
      {
        icon: Smartphone,
        title: 'Customer booking flow',
        href: '/docs#customer-booking',
        desc: 'How customers find a slot, pay a deposit, and manage their appointment from a phone.',
      },
      {
        icon: Camera,
        title: 'Photo evidence',
        href: '/docs#photos',
        desc: 'Pre-, in-progress and post-service photo capture with signed uploads and retention.',
      },
      {
        icon: Star,
        title: 'Per-vehicle loyalty',
        href: '/docs#loyalty',
        desc: 'Configure tiers, auto-apply discounts, and track visits per car instead of per customer.',
      },
    ],
  },
  {
    eyebrow: 'Money & integrations',
    items: [
      {
        icon: CreditCard,
        title: 'Stripe Connect',
        href: '/docs#stripe',
        desc: 'Connect your Stripe account, configure deposits, capture balances, and handle refunds.',
      },
      {
        icon: PlugZap,
        title: 'Integrations',
        href: '/docs#integrations',
        desc: 'Google Calendar busy sync, SMS reminders, webhooks, and what\'s on the integrations roadmap.',
      },
      {
        icon: ShieldCheck,
        title: 'Security & data handling',
        href: '/security',
        desc: 'How Splash stores customer data, payment info, photos, and what we do not store at all.',
      },
    ],
  },
];

const QUICKSTART_STEPS = [
  {
    title: 'Create your business',
    body: 'Sign up, name your business, and pick a slug. Your booking page goes live at yourslug.splash.app immediately.',
  },
  {
    title: 'Connect Stripe',
    body: 'Click Connect Stripe in Settings → Payments. Splash uses Stripe Connect Standard, so payouts arrive in your existing Stripe balance.',
  },
  {
    title: 'Add your services & zones',
    body: 'Define services with duration and price. Draw service zones, set per-zone fees, and choose a deposit amount (we recommend $20).',
  },
  {
    title: 'Set working hours',
    body: 'Pick the days and hours you take jobs. Add breaks for lunch or buffer between appointments. Block dates you\'re off.',
  },
  {
    title: 'Take your first booking',
    body: 'Share your booking link. The customer picks a slot, pays a deposit, and the appointment lands on Today.',
  },
];

export default function DocsPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title={
          <>
            Everything you need to{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              run Splash.
            </span>
          </>
        }
        description="Practical, no-fluff guides for operators. Skim the section you need or follow the quickstart end to end."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/docs#quickstart"
            className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
          >
            Start the quickstart
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="/docs/api"
            className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.08]"
          >
            Read the API reference
          </Link>
        </div>
      </PageHero>

      <PageSection>
        <div className="space-y-14">
          {SECTIONS.map((section) => (
            <div key={section.eyebrow}>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
                {section.eyebrow}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href as never}
                    className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/90">
                      <item.icon size={16} />
                    </div>
                    <h3 className="mt-5 text-[15px] font-semibold tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                      {item.desc}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#5EB1FF] opacity-0 transition-opacity group-hover:opacity-100">
                      Read more
                      <ArrowRight size={12} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection className="!pt-0">
        <div
          id="quickstart"
          className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0E1424] via-[#0B0E14] to-[#0B0E14] p-8 sm:p-12"
        >
          <div className="max-w-2xl">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
              Quickstart
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              From signup to your first booking, in five steps
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65">
              Most teams are taking real bookings within 30 minutes. Follow
              these in order — each step is independent, but they build on each
              other.
            </p>
          </div>

          <ol className="mt-10 space-y-5">
            {QUICKSTART_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-6"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </PageSection>

      <PageSection className="!pt-0 !pb-32">
        <div className="grid gap-6 lg:grid-cols-2">
          <Anchored
            id="admin"
            title="Admin dashboard"
            body={
              <>
                The admin dashboard is the home base for the day. Today shows
                your route. Schedule lays out the week. Payments shows pending
                captures and refunds. Customers, vehicles, and zones each get a
                first-class screen. Everything is mobile-first — built to live
                in your truck, not on a desk.
              </>
            }
          />
          <Anchored
            id="customer-booking"
            title="Customer booking flow"
            body={
              <>
                Customers reach your booking page at
                <code className="mx-1 rounded bg-white/5 px-1.5 py-0.5 text-[0.85em]">
                  yourslug.splash.app
                </code>
                or your custom domain. They pick a service, drop a pin, choose
                a slot from real availability, and pay a deposit through your
                Stripe account. They receive confirmation immediately and a
                self-serve link to manage the appointment.
              </>
            }
          />
          <Anchored
            id="bookings"
            title="Bookings & availability"
            body={
              <>
                Availability is generated from working hours, breaks, manual
                blocks, existing appointments, travel time between zones, and
                buffer rules. The customer never sees a slot you can&apos;t
                actually serve. Override anything from the admin in two taps.
              </>
            }
          />
          <Anchored
            id="stripe"
            title="Stripe Connect"
            body={
              <>
                Splash uses Stripe Connect Standard. You connect your existing
                Stripe account and Splash never holds your money — deposits and
                final payments go straight to your balance, with payouts on
                your normal Stripe schedule. Splash takes no per-transaction
                fee.
              </>
            }
          />
          <Anchored
            id="photos"
            title="Photo evidence"
            body={
              <>
                Capture pre-, in-progress, and post-service photos from the
                appointment screen. Uploads are signed and stored in object
                storage; only the appointment owner and admins can view them.
                Retention follows your plan (3 months on Starter, 24 months on
                Pro).
              </>
            }
          />
          <Anchored
            id="loyalty"
            title="Per-vehicle loyalty"
            body={
              <>
                Loyalty in Splash counts visits per vehicle, not per customer.
                Configure tiers like &ldquo;5 visits → 15% off&rdquo; and Splash
                applies them automatically at booking. Customers see their
                progress on the booking page.
              </>
            }
          />
          <Anchored
            id="onboarding"
            title="Onboarding checklist"
            body={
              <>
                A guided checklist appears the first time you sign in: brand
                your booking page, add services, define zones, set hours,
                connect Stripe, and run a test booking. Each step links to the
                exact screen you need.
              </>
            }
          />
          <Anchored
            id="integrations"
            title="Integrations"
            body={
              <>
                Today: Google Calendar busy sync (one-way, so personal events
                block availability), SMS reminders, and webhooks for booking
                events. On the roadmap: QuickBooks, Zapier, and a public REST
                API for Pro and Scale plans.
              </>
            }
          />
        </div>
      </PageSection>
    </>
  );
}

function Anchored({
  id,
  title,
  body,
}: {
  id: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="scroll-mt-24 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-8"
    >
      <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-white/70">{body}</p>
    </div>
  );
}
