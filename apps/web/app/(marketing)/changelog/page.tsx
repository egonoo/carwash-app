import type { Metadata } from 'next';
import { PageHero, PageSection } from '../_components/PageHero';

export const metadata: Metadata = {
  title: 'Changelog — Splash',
  description:
    'New features, improvements, and fixes across the Splash platform. Updated continuously.',
};

const ENTRIES = [
  {
    version: '2026.05',
    date: '2026-05-08',
    title: 'Mobile-first admin redesign',
    tag: 'New',
    items: [
      'Redesigned admin dashboard for the dark theme — every screen tuned for low-light field use.',
      'Today screen now shows route, ETA, and on-the-way state in a single tap.',
      'Photo capture flow rebuilt for sub-second uploads on flaky cellular.',
    ],
  },
  {
    version: '2026.04',
    date: '2026-04-12',
    title: 'Premium marketing experience',
    tag: 'New',
    items: [
      'Public homepage redesigned as a polished SaaS landing with new hero, dashboard showcase, and mobile workflow.',
      'New pricing preview with Starter, Pro, and Scale tiers.',
      'Trust strip and customer logos surfaced above the fold.',
    ],
  },
  {
    version: '2026.03',
    date: '2026-03-19',
    title: 'Per-vehicle loyalty',
    tag: 'New',
    items: [
      'Loyalty counters now track visits per vehicle instead of per customer.',
      'Operators can configure tiers like 5 visits → 15% off in Settings → Loyalty.',
      'Discounts apply automatically at booking and on the customer-facing page.',
    ],
  },
  {
    version: '2026.02',
    date: '2026-02-21',
    title: 'Stripe Connect onboarding polish',
    tag: 'Improved',
    items: [
      'Connect-account onboarding now walks operators through the exact Stripe steps.',
      'Failed deposit captures now retry with clearer error messages.',
      'Refund UI moved to the booking detail page for a faster path.',
    ],
  },
  {
    version: '2026.01',
    date: '2026-01-30',
    title: 'Zone-aware availability',
    tag: 'New',
    items: [
      'Availability now respects per-zone travel time and buffers.',
      'Customers only see slots Splash can actually serve given existing bookings.',
      'Zone fees configurable per service area.',
    ],
  },
  {
    version: '2025.12',
    date: '2025-12-14',
    title: 'Photo evidence (beta)',
    tag: 'Beta',
    items: [
      'Pre-, in-progress, and post-service photo capture from the appointment screen.',
      'Signed uploads to object storage; only admins and the appointment owner can view.',
      'Retention follows plan: 3 months on Starter, 24 months on Pro.',
    ],
  },
];

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const TAG_STYLES: Record<string, string> = {
  New: 'bg-[#0A84FF]/15 text-[#5EB1FF]',
  Improved: 'bg-emerald-400/15 text-emerald-200',
  Beta: 'bg-amber-400/15 text-amber-200',
  Fix: 'bg-rose-400/15 text-rose-200',
};

export default function ChangelogPage() {
  return (
    <>
      <PageHero
        eyebrow="Changelog"
        title={
          <>
            What&apos;s new in{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              Splash.
            </span>
          </>
        }
        description="Every meaningful improvement to the platform, in reverse chronological order. We ship continuously."
      />

      <PageSection>
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute left-[15px] top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-white/10 via-white/[0.06] to-transparent sm:left-[19px]"
          />
          <ol className="space-y-8">
            {ENTRIES.map((e) => (
              <li
                key={e.version}
                className="relative grid grid-cols-[36px,1fr] items-start gap-4 sm:grid-cols-[44px,1fr] sm:gap-6"
              >
                <span className="relative z-10 mt-1 grid h-[30px] w-[30px] place-items-center rounded-full border border-white/15 bg-[#06070A] text-[10px] font-semibold tracking-wider text-white/70 sm:h-[38px] sm:w-[38px] sm:text-[11px]">
                  {e.version.split('.')[1]}
                </span>
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                        TAG_STYLES[e.tag] ?? 'bg-white/5 text-white/70'
                      }`}
                    >
                      {e.tag}
                    </span>
                    <span className="text-xs text-white/45">
                      {formatDate(e.date)}
                    </span>
                    <span className="text-xs text-white/30">·</span>
                    <span className="text-xs font-medium text-white/55">
                      v{e.version}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                    {e.title}
                  </h2>
                  <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-white/70">
                    {e.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#5EB1FF]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-12 text-center text-xs text-white/45">
          Looking for the API changelog? It lives inside the{' '}
          <a href="/docs/api" className="text-[#5EB1FF] hover:underline">
            API reference
          </a>
          .
        </p>
      </PageSection>
    </>
  );
}
