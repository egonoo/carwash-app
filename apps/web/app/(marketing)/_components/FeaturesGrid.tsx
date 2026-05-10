'use client';

import { motion } from 'framer-motion';
import {
  Calendar,
  Camera,
  CreditCard,
  MapPin,
  Smartphone,
  Star,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Calendar,
    title: 'Smart bookings',
    desc: 'Public booking flow with zone-aware availability, working hours, breaks, and manual blocks. Customers only ever see real, bookable slots.',
    accent: 'from-sky-400/30 to-sky-400/0',
  },
  {
    icon: CreditCard,
    title: 'Deposits via Stripe Connect',
    desc: 'Hold the slot with a $20 deposit captured to the business\'s connected Stripe account. Refunds and balance payments handled in one place.',
    accent: 'from-violet-400/30 to-violet-400/0',
  },
  {
    icon: MapPin,
    title: 'Routes & zones',
    desc: 'Service areas, travel times, and per-zone fees. Build a route for the day in seconds and reroute if the day shifts.',
    accent: 'from-emerald-400/30 to-emerald-400/0',
  },
  {
    icon: Camera,
    title: 'Photo evidence',
    desc: 'Pre-, in-progress and post-service photos with signed uploads. Protect your team from disputes and feed your marketing.',
    accent: 'from-amber-400/30 to-amber-400/0',
  },
  {
    icon: Star,
    title: 'Per-vehicle loyalty',
    desc: 'Auto-applied tiers like 5 visits → 15% off, fully configurable. Counters track each car, not just each customer.',
    accent: 'from-fuchsia-400/30 to-fuchsia-400/0',
  },
  {
    icon: Smartphone,
    title: 'Mobile-first admin',
    desc: 'A polished admin built to live on a phone in the field. Mark on-the-way, arrive, capture photos, take final payment — all in one tap.',
    accent: 'from-rose-400/30 to-rose-400/0',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export function FeaturesGrid() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Built for the road"
          title="Everything a mobile detailing team needs"
          sub="Splash replaces five tools — calendar, payments, route planner, photo storage, and loyalty — with one product designed around how your crew actually works."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-80px' }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 transition-colors hover:bg-white/[0.04]"
            >
              <div
                aria-hidden
                className={`pointer-events-none absolute -inset-px -z-10 rounded-xl opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 bg-gradient-to-br ${f.accent}`}
              />
              <div className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/90">
                <f.icon size={16} />
              </div>
              <h3 className="mt-5 text-[15px] font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  sub,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  align?: 'center' | 'left';
}) {
  const cls = align === 'center' ? 'text-center mx-auto' : 'text-left';
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={fadeUp}
      transition={{ duration: 0.5 }}
      className={`max-w-2xl ${cls}`}
    >
      {eyebrow && (
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#5EB1FF]">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {sub && (
        <p className="mt-4 text-balance text-base leading-relaxed text-white/65">
          {sub}
        </p>
      )}
    </motion.div>
  );
}
