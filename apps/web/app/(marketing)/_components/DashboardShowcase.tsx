'use client';

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { DashboardMockup } from './DashboardMockup';
import { SectionHeader } from './FeaturesGrid';

const HIGHLIGHTS = [
  {
    title: "Today's route at a glance",
    desc: 'Every job for the day, sorted by zone, with one-tap status changes. The crew knows exactly what comes next.',
  },
  {
    title: 'Real-time KPIs',
    desc: 'Bookings, revenue, no-show rate, and average ticket — measured against last week so trends jump out.',
  },
  {
    title: 'Activity that earns trust',
    desc: 'Deposits, photo uploads, loyalty unlocks and reviews land in a single feed. Nothing slips through.',
  },
];

export function DashboardShowcase() {
  return (
    <section id="dashboard" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="The admin"
          title="A dashboard that does the heavy lifting"
          sub="Splash's admin panel is the control room for your business. Schedule, payments, photos, and loyalty live in one place — no spreadsheets, no DMs."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:items-center">
          <ul className="space-y-5">
            {HIGHLIGHTS.map((h, i) => (
              <motion.li
                key={h.title}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="flex gap-3"
              >
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-[#5EB1FF]"
                  size={18}
                />
                <div>
                  <div className="text-[15px] font-semibold">{h.title}</div>
                  <div className="mt-1 text-sm leading-relaxed text-white/60">
                    {h.desc}
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl opacity-60 blur-3xl"
              style={{
                background:
                  'radial-gradient(60% 60% at 60% 40%, rgba(94,177,255,0.25), transparent 70%)',
              }}
            />
            <div className="rounded-2xl border border-white/10 bg-[#0B0E14]/80 p-2 shadow-[0_30px_120px_-30px_rgba(10,132,255,0.4)]">
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <DashboardMockup />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
