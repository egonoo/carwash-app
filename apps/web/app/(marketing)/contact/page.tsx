import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, LifeBuoy, Mail, MessageSquareHeart } from 'lucide-react';
import { GlassCard, PageHero, PageSection } from '../_components/PageHero';

// TODO: Replace this placeholder address once the Hostinger mailbox is live.
// All `mailto:` links and rendered email strings on this page should be
// updated together (and the same string is referenced from /security and /legal/dpa).
const CONTACT_EMAIL = 'hello@getsplashwash.com';

export const metadata: Metadata = {
  title: 'Contact — Splash',
  description:
    'Get in touch with the Splash team. Sales, support, partnerships, and press — we read every message.',
};

const REASONS = [
  {
    icon: Building2,
    title: 'Sales & onboarding',
    desc: 'Multi-truck operator? Migrating from another tool? We\'ll walk you through setup and quote you a Scale plan.',
  },
  {
    icon: LifeBuoy,
    title: 'Customer support',
    desc: 'Already on Splash? Reach the support team for help with bookings, payouts, integrations, or your account.',
  },
  {
    icon: MessageSquareHeart,
    title: 'Partnerships & press',
    desc: 'Suppliers, training providers, journalists — pitch us and we\'ll route you to the right person.',
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={
          <>
            Talk to a real person at{' '}
            <span className="bg-gradient-to-r from-white via-white to-[#5EB1FF] bg-clip-text text-transparent">
              Splash.
            </span>
          </>
        }
        description="No ticket queue, no chatbot maze. Send us a note and a member of the team will reply within one business day."
      />

      <PageSection>
        <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
          <GlassCard className="lg:p-10">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white">
                <Mail size={18} />
              </span>
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/50">
                  Email
                </div>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-lg font-semibold text-white hover:text-[#5EB1FF]"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </div>

            <p className="mt-6 text-[15px] leading-relaxed text-white/70">
              The fastest way to reach us is email. Include a sentence or two
              about what you&apos;re working on and the best phone number to call
              you back on if needed. We try to reply within one business day,
              and we never auto-respond.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                  Hours
                </div>
                <p className="mt-2 text-sm text-white/80">
                  Mon&ndash;Fri, 8am&ndash;6pm Pacific
                </p>
                <p className="mt-1 text-xs text-white/50">
                  Weekends covered for live operators on Pro and Scale.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                  Response time
                </div>
                <p className="mt-2 text-sm text-white/80">
                  Within 1 business day
                </p>
                <p className="mt-1 text-xs text-white/50">
                  Urgent payment or booking issues are triaged first.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=Hello%20Splash`}
                className="group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-medium text-[#06070A] transition-transform hover:-translate-y-[1px]"
              >
                Email the team
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </a>
              <Link
                href="/help"
                className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/90 hover:bg-white/[0.08]"
              >
                Browse help center
              </Link>
            </div>
          </GlassCard>

          <div className="space-y-4">
            {REASONS.map((r) => (
              <div
                key={r.title}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6"
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/90">
                    <r.icon size={16} />
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight">
                      {r.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                      {r.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#0A84FF]/[0.08] via-white/[0.02] to-transparent p-6">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#5EB1FF]">
                Mailing address
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                Splash Software, Inc.
                <br />
                Address available on request — please email us first.
              </p>
            </div>
          </div>
        </div>
      </PageSection>
    </>
  );
}
