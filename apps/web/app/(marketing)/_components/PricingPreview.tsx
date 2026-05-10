'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { SectionHeader } from './FeaturesGrid';

const TIERS = [
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: 'For solo detailers and weekend operators getting their first jobs online.',
    features: [
      'Public booking page',
      'Stripe Connect deposits',
      'Up to 50 bookings / month',
      '1 service area',
      'Photo evidence (3 months)',
    ],
    cta: 'Start free trial',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$129',
    period: '/month',
    description: 'For full-time crews running multiple zones and a steady book of business.',
    features: [
      'Everything in Starter',
      'Unlimited bookings',
      'Unlimited zones & breaks',
      'Per-vehicle loyalty tiers',
      'Photo retention (24 months)',
      'SMS reminders',
      'Google Calendar busy sync',
    ],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Scale',
    price: 'Custom',
    period: '',
    description: 'For multi-truck operators with custom workflows and enterprise needs.',
    features: [
      'Everything in Pro',
      'Multi-resource scheduling',
      'Custom domain',
      'Priority support',
      'SOC 2 / DPA on request',
      'Onboarding & migration',
    ],
    cta: 'Talk to sales',
    highlighted: false,
  },
];

export function PricingPreview() {
  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple plans, built for the way detailing teams grow"
          sub="Start free. Pay monthly. Cancel any time. Card processing through your own Stripe account — we never touch your payouts."
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                t.highlighted
                  ? 'border-[#0A84FF]/40 bg-gradient-to-b from-[#0A84FF]/[0.08] via-white/[0.02] to-transparent shadow-[0_30px_120px_-30px_rgba(10,132,255,0.5)]'
                  : 'border-white/[0.07] bg-white/[0.02]'
              }`}
            >
              {t.highlighted && (
                <span className="absolute -top-3 left-7 rounded-full bg-[#0A84FF] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">
                  {t.price}
                </span>
                {t.period && (
                  <span className="text-sm text-white/50">{t.period}</span>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                {t.description}
              </p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px]">
                    <Check
                      size={14}
                      className={`mt-0.5 shrink-0 ${
                        t.highlighted ? 'text-[#5EB1FF]' : 'text-emerald-300'
                      }`}
                    />
                    <span className="text-white/80">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={t.name === 'Scale' ? '/contact' : '/signup'}
                className={`mt-7 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                  t.highlighted
                    ? 'bg-white text-[#06070A] hover:bg-white/90'
                    : 'border border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.06]'
                }`}
              >
                {t.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/40">
          Stripe processing fees (2.9% + 30¢) are billed by Stripe directly. Splash adds nothing on top.
        </p>
      </div>
    </section>
  );
}
