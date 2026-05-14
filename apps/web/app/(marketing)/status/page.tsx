import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { GlassCard, PageHero, PageSection } from '../_components/PageHero';

export const metadata: Metadata = {
  title: 'System status — Splash',
  description: 'Real-time status of Splash services: app, booking, payments, database, and notifications.',
};

const SERVICES = [
  { name: 'App (admin dashboard)', desc: 'splash.app and app.splash.app — login, dashboard, and admin tools.' },
  { name: 'Booking', desc: 'Public booking pages, slot resolution, and appointment confirmation.' },
  { name: 'Payments', desc: 'Stripe Connect deposits, balance captures, and refunds.' },
  { name: 'Database', desc: 'Primary Postgres, customer and booking data, photo metadata.' },
  { name: 'Email & SMS', desc: 'Transactional notifications: confirmations, reminders, receipts.' },
];

const HISTORY = [
  { date: 'No incidents in the last 30 days', label: 'Clear' },
];

export default function StatusPage() {
  return (
    <>
      <PageHero
        eyebrow="System status"
        title={
          <>
            All systems{' '}
            <span className="bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-400 bg-clip-text text-transparent">
              operational.
            </span>
          </>
        }
        description="A high-level view of Splash service health. Real-time monitoring integration is on the roadmap — for now, this page is updated by the Splash team."
      />

      <PageSection>
        <GlassCard>
          <div className="flex flex-col gap-2 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
                Current status
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <span className="relative inline-flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                All systems operational
              </div>
            </div>
            <div className="text-xs text-white/50">
              Last updated automatically on each page load
            </div>
          </div>

          <ul className="mt-2 divide-y divide-white/[0.05]">
            {SERVICES.map((s) => (
              <li
                key={s.name}
                className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-[15px] font-medium text-white">
                    {s.name}
                  </div>
                  <div className="mt-1 text-sm text-white/55">{s.desc}</div>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
                  <CheckCircle2 size={12} />
                  Operational
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </PageSection>

      <PageSection className="!pt-0 !pb-32">
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#5EB1FF]">
              Incident history
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              Last 30 days
            </h2>
            <ul className="mt-5 space-y-3">
              {HISTORY.map((h) => (
                <li
                  key={h.date}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <span className="text-sm text-white/75">{h.date}</span>
                  <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-emerald-300">
                    {h.label}
                  </span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-[#5EB1FF]">
              Subscribe to updates
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              Stay informed
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Real monitoring and status webhooks are not yet wired up. While
              we finish that integration, the team posts incident updates by
              email to all active customers within 15 minutes of detection.
            </p>
            <p className="mt-4 text-xs text-white/45">
              Note: this page is a polished placeholder. Real-time uptime
              metrics will replace the manual status once monitoring is live.
            </p>
          </GlassCard>
        </div>
      </PageSection>
    </>
  );
}
