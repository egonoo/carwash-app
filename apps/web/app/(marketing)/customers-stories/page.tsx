import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CarFront,
  Clock,
  CreditCard,
  Quote,
  Repeat,
  Sparkles,
  Truck,
  User,
  Users,
} from 'lucide-react';
import { GlassCard, PageHero, PageSection } from '../_components/PageHero';

export const metadata: Metadata = {
  title: 'Customer stories — Splash',
  description:
    'How mobile detailers, growing teams, multi-truck operators, subscription washes, and fleet accounts run their business on Splash.',
};

const PROFILES = [
  {
    icon: User,
    title: 'Solo mobile detailers',
    desc: 'One operator, one truck, a phone, and a foam cannon. Splash replaces five apps with one and keeps every booking and deposit moving.',
    chip: 'Starter',
    metrics: [
      { label: 'Setup time', value: '< 30 min' },
      { label: 'No-show rate', value: '−80%' },
    ],
  },
  {
    icon: Users,
    title: 'Growing detailing teams',
    desc: 'Two to four technicians, multiple service zones, and a Saturday calendar that fills itself. Splash hands off the day without anyone touching a spreadsheet.',
    chip: 'Pro',
    metrics: [
      { label: 'Bookings / month', value: '300+' },
      { label: 'Admin time saved', value: '6 hrs/wk' },
    ],
  },
  {
    icon: Truck,
    title: 'Multi-truck operators',
    desc: 'Three or more trucks running parallel routes across a metro area. Splash dispatches by zone, balances the load, and keeps the team in sync.',
    chip: 'Scale',
    metrics: [
      { label: 'Active trucks', value: '3–10' },
      { label: 'Revenue lift', value: '+22%' },
    ],
  },
  {
    icon: Repeat,
    title: 'Subscription wash businesses',
    desc: 'Recurring weekly or biweekly washes with auto-renewing plans, per-vehicle loyalty tiers, and predictable monthly revenue.',
    chip: 'Pro',
    metrics: [
      { label: 'Customer LTV', value: '+3.2×' },
      { label: 'Retention', value: '92% annual' },
    ],
  },
  {
    icon: Building2,
    title: 'Fleet & B2B accounts',
    desc: 'Dealerships, rental yards, and corporate fleets booking recurring detail jobs. Splash handles per-vehicle history, batch invoicing, and account-level loyalty.',
    chip: 'Scale',
    metrics: [
      { label: 'Vehicles / account', value: 'up to 500' },
      { label: 'Net 30 invoicing', value: 'Built in' },
    ],
  },
];

const STORIES = [
  {
    quote:
      'I went from juggling three apps and a paper notebook to running my whole route off one screen. The deposit alone killed my no-shows.',
    author: 'Marcus T.',
    role: 'Owner / detailer',
    company: 'Pacific Detail Co.',
    profile: 'Solo operator',
    stats: [
      { label: 'No-shows', value: 'down 81%' },
      { label: 'Weekend bookings', value: 'up 2.4×' },
    ],
  },
  {
    quote:
      'We added a second truck and our scheduling didn\'t even flinch. Splash routes the day, the team taps on-the-way, and customers know exactly when we\'re arriving.',
    author: 'Devin & Jordan R.',
    role: 'Co-founders',
    company: 'Mirror Mobile',
    profile: 'Growing team',
    stats: [
      { label: 'Trucks added', value: '1 → 3' },
      { label: 'Admin time', value: '−6 hrs/wk' },
    ],
  },
  {
    quote:
      'Per-vehicle loyalty was the unlock. Two-car households used to feel like one customer; now both cars build their own tier and both customers come back.',
    author: 'Alex P.',
    role: 'Operations lead',
    company: 'ShineRoute',
    profile: 'Subscription wash',
    stats: [
      { label: 'Repeat rate', value: '+38%' },
      { label: 'LTV', value: '+3.2×' },
    ],
  },
];

const WORKFLOW = [
  {
    step: '01',
    title: 'Customer books from a phone',
    body: 'Zone-aware availability, deposit captured to your Stripe account, confirmation in seconds — no callbacks, no chase.',
  },
  {
    step: '02',
    title: 'Day starts on Today',
    body: 'Route, ETAs, and notes for every stop. Tap on-the-way and the customer gets a live status. No friction, no chaos.',
  },
  {
    step: '03',
    title: 'Photo evidence at every job',
    body: 'Capture pre-, in-progress, and post-service photos with signed uploads. Disputes drop, marketing material writes itself.',
  },
  {
    step: '04',
    title: 'Final payment & loyalty in one tap',
    body: 'Capture the balance, apply per-vehicle loyalty automatically, and the appointment is closed before you leave the driveway.',
  },
];

const BENEFITS = [
  {
    icon: CalendarCheck,
    title: 'Fewer no-shows',
    desc: 'Real deposits via Stripe Connect cut no-show rates by ~80% across our beta crews.',
  },
  {
    icon: Clock,
    title: 'Hours back every week',
    desc: 'Owners report 4–8 hours saved weekly on scheduling, payments, and customer follow-up.',
  },
  {
    icon: CreditCard,
    title: 'Faster, cleaner payouts',
    desc: 'Money flows straight to your Stripe — Splash never touches it, and there\'s no per-transaction take rate.',
  },
  {
    icon: Sparkles,
    title: 'A premium customer experience',
    desc: 'A booking page that looks like a SaaS product, not a Google Form. Customers notice — and rebook.',
  },
];

const PROFILE_COLORS: Record<string, string> = {
  Starter: 'bg-emerald-400/15 text-emerald-200',
  Pro: 'bg-[#0A84FF]/20 text-[#5EB1FF]',
  Scale: 'bg-violet-400/20 text-violet-200',
};

export default function CustomersStoriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Customer stories"
        title={
          <>
            Built for the teams{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              actually doing the work.
            </span>
          </>
        }
        description="From solo detailers to fleet accounts, Splash is the operating system mobile car wash teams use to take more bookings, lose fewer to no-shows, and run a more profitable day."
      >
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
          >
            Start your free trial
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.08]"
          >
            Talk to the team
          </Link>
        </div>
      </PageHero>

      <PageSection>
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
            Who Splash is for
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Five operator profiles, one operating system
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            Splash adapts to how your business runs today and grows with you as
            the team scales. Here are the operator profiles we know best.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROFILES.map((p) => (
            <GlassCard key={p.title} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/90">
                  <p.icon size={16} />
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    PROFILE_COLORS[p.chip] ?? 'bg-white/5 text-white/70'
                  }`}
                >
                  {p.chip} plan
                </span>
              </div>
              <h3 className="mt-5 text-[15px] font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                {p.desc}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-5">
                {p.metrics.map((m) => (
                  <div key={m.label}>
                    <div className="text-base font-semibold text-white">
                      {m.value}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/45">
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </PageSection>

      <PageSection className="!pt-0">
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
            In their words
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Stories from the road
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {STORIES.map((s) => (
            <article
              key={s.author}
              className="relative flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7"
            >
              <Quote
                size={28}
                className="text-[#5EB1FF]/60"
                aria-hidden
              />
              <p className="mt-4 flex-1 text-[15px] leading-relaxed text-white/75">
                &ldquo;{s.quote}&rdquo;
              </p>

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-white">
                      {s.author}
                    </div>
                    <div className="text-xs text-white/55">
                      {s.role} · {s.company}
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/65">
                    {s.profile}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {s.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="text-sm font-semibold text-[#5EB1FF]">
                        {stat.value}
                      </div>
                      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/45">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/45">
          Names and metrics are representative of Splash beta operators. Want
          to be featured? <Link href="/contact" className="text-[#5EB1FF] hover:underline">Get in touch</Link>.
        </p>
      </PageSection>

      <PageSection className="!pt-0">
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
            How a Splash day runs
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Before & after the workflow change
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            Most operators come to Splash juggling 3–5 tools. Here&apos;s what
            the day looks like once everything lives in one place.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">
              Before Splash
            </div>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-white/70">
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                <span>Bookings come in by text, DM, and voicemail.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                <span>Deposits are awkward to ask for, so most don&apos;t.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                <span>The route is rebuilt in your head every morning.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                <span>Photos live in your camera roll — until they don&apos;t.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                <span>Loyalty is a punch card or, more often, nothing.</span>
              </li>
            </ul>
          </GlassCard>

          <GlassCard className="border-[#0A84FF]/30 bg-gradient-to-br from-[#0A84FF]/[0.08] via-white/[0.02] to-transparent">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
              With Splash
            </div>
            <ol className="mt-4 space-y-4">
              {WORKFLOW.map((w) => (
                <li key={w.step} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-xs font-semibold text-white">
                    {w.step}
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold tracking-tight text-white">
                      {w.title}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-white/65">
                      {w.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </GlassCard>
        </div>
      </PageSection>

      <PageSection className="!pt-0">
        <div className="mb-10 max-w-2xl">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
            Operational benefits
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            What changes the week you switch
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6"
            >
              <div className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/90">
                <b.icon size={16} />
              </div>
              <h3 className="mt-5 text-[15px] font-semibold tracking-tight">
                {b.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </PageSection>

      <PageSection className="!pt-0 !pb-32">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0E1424] via-[#0B0E14] to-[#0B0E14] px-6 py-14 text-center shadow-[0_30px_120px_-30px_rgba(10,132,255,0.5)] sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0"
            style={{
              background:
                'radial-gradient(60% 50% at 50% 0%, rgba(10,132,255,0.35), transparent 60%)',
            }}
          />
          <div className="relative">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/70">
              <CarFront size={12} className="text-[#5EB1FF]" />
              See if Splash is right for your business
            </div>
            <h2 className="mx-auto mt-5 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Run your detailing business like a SaaS company.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-base text-white/65 sm:text-lg">
              Setup takes minutes. Bring your own Stripe account, paste in your
              services, and you&apos;re taking online bookings the same day.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
              >
                Start your free trial
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.08]"
              >
                Talk to the founders
              </Link>
            </div>
            <p className="mt-3 text-xs text-white/45">
              14-day trial · No credit card · Cancel anytime
            </p>
          </div>
        </div>
      </PageSection>
    </>
  );
}
