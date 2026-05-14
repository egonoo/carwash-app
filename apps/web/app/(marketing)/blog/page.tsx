import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { PageHero, PageSection } from '../_components/PageHero';

export const metadata: Metadata = {
  title: 'Blog — Splash',
  description:
    'Notes from the road on running a mobile car wash and detailing business — from operators, for operators.',
};

const POSTS = [
  {
    slug: 'why-per-vehicle-loyalty',
    title: 'Why we count loyalty per vehicle, not per customer',
    excerpt:
      'A two-car household is two routes, two services, and two relationships. Counting loyalty per car turns out to change everything about retention.',
    date: '2026-04-22',
    readTime: '4 min read',
    tag: 'Product',
  },
  {
    slug: 'deposits-fix-no-shows',
    title: 'How a $20 deposit eliminated 80% of our no-shows',
    excerpt:
      'We pulled six months of booking data from our private beta crews and looked at what actually moves the needle on no-show rates. The answer is boring and unambiguous.',
    date: '2026-03-30',
    readTime: '6 min read',
    tag: 'Operations',
  },
  {
    slug: 'mobile-first-admin',
    title: 'Designing an admin dashboard for the front seat of a truck',
    excerpt:
      'Most SaaS dashboards assume a desk and a quiet office. Mobile detailing assumes neither. Here\'s what we changed when we redesigned the Splash admin.',
    date: '2026-03-11',
    readTime: '5 min read',
    tag: 'Design',
  },
  {
    slug: 'stripe-connect-for-detailers',
    title: 'A plain-English guide to Stripe Connect for detailers',
    excerpt:
      'You shouldn\'t need a finance degree to take a deposit. Here\'s how Stripe Connect works, why we picked Standard, and what it means for your payouts.',
    date: '2026-02-18',
    readTime: '7 min read',
    tag: 'Payments',
  },
];

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Splash blog"
        title={
          <>
            Notes from the road,{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              for operators.
            </span>
          </>
        }
        description="Product updates, operating playbooks, and field notes from real mobile detailing teams. We publish when we have something useful to say."
      />

      <PageSection>
        <div className="grid gap-4 md:grid-cols-2">
          {POSTS.map((p) => (
            <article
              key={p.slug}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04] sm:p-8"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-[#0A84FF]/[0.18] to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="flex items-center gap-3 text-xs">
                <span className="rounded-full bg-[#0A84FF]/15 px-2.5 py-1 font-medium text-[#5EB1FF]">
                  {p.tag}
                </span>
                <span className="text-white/45">{formatDate(p.date)}</span>
                <span className="text-white/30">·</span>
                <span className="text-white/45">{p.readTime}</span>
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
                {p.title}
              </h2>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-white/65">
                {p.excerpt}
              </p>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#5EB1FF]">
                Read the full post
                <ArrowRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-white/45">
          Individual post pages are coming soon. In the meantime, follow along
          via email below.
        </p>
      </PageSection>

      <PageSection className="!pt-0 !pb-32">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0E1424] via-[#0B0E14] to-[#0B0E14] p-8 sm:p-12">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white">
                <BookOpen size={18} />
              </span>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">
                  Get new posts in your inbox
                </h3>
                <p className="mt-2 max-w-md text-sm text-white/65">
                  One short email when something new lands. No drip funnel, no
                  selling.
                </p>
              </div>
            </div>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
            >
              Subscribe
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </PageSection>
    </>
  );
}
